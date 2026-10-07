import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { LegacyToActions } from "../utils/moderationManager.js";

// Moves the old timeout/banned/banreason/banduration columns into the new moderation column
// Run this BEFORE you push the new schema, otherwise drizzle-kit drops the old columns with the data in them
//   npx tsx scripts/migrateModeration.ts --dry   (only shows what would happen)
//   npx tsx scripts/migrateModeration.ts
// After it finishes run drizzle-kit push to remove the old columns
// Safe to run again, profiles that already have moderation entries are skipped

const dry = process.argv.includes("--dry");

const oldColumns = ["timeout", "banned", "banreason", "banduration"];

// depending on the driver the rows are either the result itself or in .rows
async function Query<T = Record<string, unknown>>(query: ReturnType<typeof sql>): Promise<T[]> {
	const result = await db.execute(query);
	return (Array.isArray(result) ? result : (result as unknown as { rows: T[] }).rows) as T[];
}

try {
	const columns = await Query<{ column_name: string }>(sql`
		SELECT column_name FROM information_schema.columns
		WHERE table_name = 'user_profiles'
		AND column_name IN ('timeout', 'banned', 'banreason', 'banduration', 'moderation')
	`);
	const names = columns.map((row) => row.column_name);
	const hasOld = oldColumns.every((column) => names.includes(column));
	const hasNew = names.includes("moderation");

	if (!hasOld) {
		console.log("The old columns are already gone, nothing to migrate.");
	} else {
		if (!hasNew) {
			if (dry) {
				console.log("[dry] would add the moderation column");
			} else {
				await db.execute(sql`ALTER TABLE user_profiles ADD COLUMN moderation jsonb NOT NULL DEFAULT '[]'::jsonb`);
				console.log("Added the moderation column");
			}
		}

		// profiles that already have moderation entries are skipped
		const rows = await Query<{
			id: string;
			timeout: string | null;
			banned: boolean | null;
			banreason: string | null;
			banduration: string | null;
		}>(hasNew
			? sql`SELECT id, timeout, banned, banreason, banduration FROM user_profiles
				WHERE (timeout IS NOT NULL OR banned OR banreason IS NOT NULL OR banduration IS NOT NULL)
				AND moderation = '[]'::jsonb`
			: sql`SELECT id, timeout, banned, banreason, banduration FROM user_profiles
				WHERE (timeout IS NOT NULL OR banned OR banreason IS NOT NULL OR banduration IS NOT NULL)`);

		let migrated = 0;
		let skipped = 0;

		for (const row of rows) {
			// bigint comes back as a string from postgres
			const actions = LegacyToActions({
				timeout: row.timeout === null ? null : Number(row.timeout),
				banned: row.banned,
				banreason: row.banreason,
				banduration: row.banduration,
			});

			// old data that isnt active anymore (ended mutes, cleared bans) has nothing to save
			if (actions.length === 0) {
				skipped++;
				continue;
			}

			if (dry) {
				console.log(`[dry] ${row.id}:`, JSON.stringify(actions));
			} else {
				await db.execute(sql`
					UPDATE user_profiles SET moderation = ${JSON.stringify(actions)}::jsonb
					WHERE id = ${row.id} AND moderation = '[]'::jsonb
				`);
			}
			migrated++;
		}

		console.log(`${dry ? "[dry] " : ""}Done! Migrated: ${migrated}, Nothing to save: ${skipped}`);
		if (!dry) console.log("Now run drizzle-kit push to remove the old columns.");
	}
} finally {
	await db.$client.end();
}
