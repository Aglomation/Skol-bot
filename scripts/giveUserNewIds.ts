import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { relations } from "../db/relations.js";
import { userProfileTable } from "../db/schema.js";

const sql = neon(process.env.DATABASE_URL || "");
const db = drizzle({ client: sql, relations });

try {
	const usersWithoutIds = await db.query.userProfileTable.findMany({
		where: { id: { isNull: true } },
	});

	for (const user of usersWithoutIds) {
		await db
			.update(userProfileTable)
			.set({ id: crypto.randomUUID() })
			.where(eq(userProfileTable.discordId, user.discordId));
	}

	console.log("Gave random IDs to users with no id:", usersWithoutIds.length);
} catch (error) {
	console.error("Error giving users new IDs:", error);
}
