import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { userProfileTable } from "../db/schema.js";

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
