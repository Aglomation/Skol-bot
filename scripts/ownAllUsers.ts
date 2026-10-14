import { db } from "../db/client.js";
import { userProfileTable } from "../db/schema.js";

// Puts every profile in one server, only for when the bot had a single server and nothing else
// Run it with the server id, and --yes to really do it: npx tsx scripts/ownAllUsers.ts <serverId> --yes
const serverId = process.argv[2];
if (!serverId || !process.argv.includes("--yes")) {
	console.error("Usage: npx tsx scripts/ownAllUsers.ts <serverId> --yes");
	process.exit(1);
}

try {
	const update = await db.update(userProfileTable).set({
		serverId,
	});

	console.log("Updated all user profiles", update.rowCount);
} catch (error) {
	console.error("Error updating user profiles:", error);
}
process.exit(0);
