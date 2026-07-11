import type { Client } from "discord.js";
import "dotenv/config";
import { GetProfile } from "../../utils/profileManager.js";

const repeating: Repeating = {
	data: {
		immediate: false,
		repeating: true,
		time: 1 * 60 * 60 * 1000,
		clockTime: null,
	},

	async execute(client: Client) {
		if (!process.env.GUILD_ID) {
			console.error("GUILD_ID is not set in environment variables.");
			return;
		}

		const guild = await client.guilds.fetch(process.env.GUILD_ID);
		const members = guild.members.cache;

		if (!members) return;

		const timedOutMembers = members.filter((member) =>
			member.isCommunicationDisabled(),
		);

		console.log(`Found ${timedOutMembers.size} users currently on timeout.`);

		timedOutMembers.forEach(async (member) => {
			const profile = await GetProfile(member.id);
			if (!profile?.timeout) return;

			console.log(
				`- ${member.user.tag} (Unmuted at: ${member.communicationDisabledUntil})`,
			);
			const timeLeft = profile.timeout - Date.now();
			const MAX_TIMEOUT_MS = 2419199000; // 28 days - 1s in milliseconds
			if (timeLeft <= 0) {
				member.timeout(null, "Timeout should already have been cleared by discord?")
					.catch((err) => console.error(`Failed to remove timeout for ${member.user.tag}:`, err));
				return;
			}
			
			// Refreshes the timeout
			member
				.timeout(
					Math.min(timeLeft, MAX_TIMEOUT_MS),
					`Refreshing timeout, Expires at: ${new Date(profile.timeout).toISOString()}`,
				)
				.catch((err) => {
					console.error(
						`Failed to refresh timeout for ${member.user.tag}:`,
						err,
					);
				});
		});
	},
};

export default repeating;
