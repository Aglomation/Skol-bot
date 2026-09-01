import fs from "node:fs";
import { db } from "../db/client.js";
import { userProfileTable } from "../db/schema.js";

const PROFILE_FILE = "./storage/profiles.json";

export type ProfileList = Record<string, UserProfile>;

const stats = {
	goal: 0,
	total: 0,
	migrated: 0,
	failed: 0,
};

const failedProfiles: Record<string, UserProfile> = {};

fs.readFile(PROFILE_FILE, "utf-8", (err, data) => {
	if (err) {
		console.error("Error reading profiles:", err);
		return;
	}

	try {
		const profiles: ProfileList = JSON.parse(data);
		stats.goal = Object.entries(profiles).length;
		for (const [userId, profile] of Object.entries(profiles)) {
			try {
				const newData: UserProfile = {
					verifycode: profile.verifycode ?? null,
					email: profile.email ?? null,
					timeout: profile.timeout ?? null,
					banned: profile.banned ?? false,
					banreason: profile.banreason ?? null,
					banduration: profile.banduration ?? null,
					birthday: profile.birthday ?? null,
				};

				stats.total++;

				db.insert(userProfileTable)
					.values({
						id: userId,
						...newData,
					})
					.then(() => {
						stats.migrated++;
						console.log(`[✅] Migrated profile for user ${userId}`);
					})
					.catch((dbErr) => {
						console.error(
							`[❌] Error inserting profile for user ${userId}:`,
							dbErr,
						);
						failedProfiles[userId] = profile;
						stats.failed++;
					});
			} catch (parseErr) {
				console.error(
					`[❌] Error parsing profile for user ${userId}:`,
					parseErr,
				);
				failedProfiles[userId] = profile;
				stats.failed++;
			}
		}
	} catch (parseErr) {
		console.error(`[❌] Something went very wrong:`, parseErr);
	}

	// Wait for all insertions to complete before logging final stats
	const checkCompletion = setInterval(() => {
		if (stats.migrated + stats.failed === stats.goal) {
			clearInterval(checkCompletion);
			console.log(
				`Migration complete! Total: ${stats.total}, Migrated: ${stats.migrated}, Failed: ${stats.failed}`,
			);
			if (stats.failed > 0) {
				console.log("Failed profiles:", failedProfiles);
			}
		}
	}, 1000);
});
