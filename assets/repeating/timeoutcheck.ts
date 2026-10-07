import type { Client } from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import "dotenv/config";
import { GetMuteExpiry, IgnoreTimeoutChange } from "../../utils/moderationManager.js";
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
		for (const [guildId, guild] of client.guilds.cache) {

			if (!guild) {
				console.error(`Guild with ID ${process.env.GUILD_ID} not found.`);
				return;
			}
			const members = guild.members.cache;

			if (!members || !guild.members.me?.permissions.has(PermissionFlagsBits.ModerateMembers)) continue;

			const timedOutMembers = members.filter((member) =>
				member.isCommunicationDisabled(),
			);

			console.log(`Found ${timedOutMembers.size} users currently on timeout.`);

			timedOutMembers.forEach(async (member) => {
				const profile = await GetProfile(member.id, guildId);
				// when the mute ends (Infinity = never, 0 = unmuted), null means we have no record of a mute
				const expiry = GetMuteExpiry(profile);
				if (expiry === null) return;

				console.log(
					`- ${member.user.tag} (Unmuted at: ${member.communicationDisabledUntil})`,
				);
				const timeLeft = expiry - Date.now();
				const MAX_TIMEOUT_MS = 2419199000; // 28 days - 1s in milliseconds
				if (timeLeft <= 0) {
					IgnoreTimeoutChange(member.id);
					member.timeout(null, "Timeout should already have been cleared by discord?")
						.catch((err) => console.error(`Failed to remove timeout for ${member.user.tag}:`, err));
					return;
				}
				
				// Refreshes the timeout
				member
					.timeout(
						Math.min(timeLeft, MAX_TIMEOUT_MS),
						`Refreshing timeout, Expires at: ${Number.isFinite(expiry) ? new Date(expiry).toISOString() : "never"}`,
					)
					.catch((err) => {
						console.error(
							`Failed to refresh timeout for ${member.user.tag}:`,
							err,
						);
					});
			});
		}
	},
};

export default repeating;
