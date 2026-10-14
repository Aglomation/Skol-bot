import { eq, isNotNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { userProfileTable } from "../db/schema.js";

// Birthdays are saved as midnight UTC now, they used to be saved as midnight of the timezone of the machine that ran the bot
// In Sweden that is 22:00 or 23:00 UTC the day before, so those are moved to the right day
// Run it to see what would change: npx tsx scripts/fixBirthdays.ts
// And with --yes to change it: npx tsx scripts/fixBirthdays.ts --yes
const apply = process.argv.includes("--yes");

const profiles = await db
	.select({ id: userProfileTable.id, discordId: userProfileTable.discordId, birthday: userProfileTable.birthday })
	.from(userProfileTable)
	.where(isNotNull(userProfileTable.birthday));

let fixed = 0;
for (const profile of profiles) {
	if (profile.birthday == null) continue;

	const date = new Date(profile.birthday * 1000);
	const isMidnightUtc = date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0;
	if (isMidnightUtc) continue;

	// later than noon UTC means it was midnight in a timezone ahead of UTC, so the date is the next day
	const year = date.getUTCFullYear();
	const month = date.getUTCMonth();
	const day = date.getUTCDate() + (date.getUTCHours() >= 12 ? 1 : 0);
	const corrected = Math.floor(Date.UTC(year, month, day) / 1000);

	console.log(`${profile.discordId}: ${date.toISOString()} -> ${new Date(corrected * 1000).toISOString()}`);
	fixed++;

	if (apply) {
		await db.update(userProfileTable).set({ birthday: corrected }).where(eq(userProfileTable.id, profile.id));
	}
}

console.log(`${fixed} birthday(s) ${apply ? "fixed" : "would be fixed, run with --yes to do it"}.`);
process.exit(0);
