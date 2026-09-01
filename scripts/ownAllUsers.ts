import { db } from "../db/client.js";
import { userProfileTable } from "../db/schema.js";

try {
	const update = await db.update(userProfileTable).set({
		serverId: "1497140069746741338",
	});

	console.log("Updated all user profiles", update.rowCount);
} catch (error) {
	console.error("Error updating user profiles:", error);
}
