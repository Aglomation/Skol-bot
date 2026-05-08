import type { Client } from "discord.js";
import "dotenv/config";
import { GetProfile } from "../../utils/profileManager.js";

const repeating = {
	repeating: true,
	time: 1 * 60 * 60 * 1000,
	immediate: false,

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

			// Refreshes the timeout
			member
				.timeout(
					Math.min(profile?.timeout, 28 * 24 * 60 * 60 * 1000 - 1000),
					"Refreshing timeout",
				)
				.catch((err) => {
					console.error(
						`Failed to refresh timeout for ${member.user.tag}:`,
						err,
					);
				});
		});

		return timedOutMembers;
	},
};

export default repeating;
