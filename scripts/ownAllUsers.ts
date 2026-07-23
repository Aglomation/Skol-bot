import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { relations } from "../db/relations.js";
import { userProfileTable } from "../db/schema.js";

const sql = neon(process.env.DATABASE_URL || "");
const db = drizzle({ client: sql, relations });

try {
	const update = await db.update(userProfileTable).set({
		serverId: "1497140069746741338",
	});

	console.log("Updated all user profiles", update.rowCount);
} catch (error) {
	console.error("Error updating user profiles:", error);
}
