import type { Client } from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import { GetMuteExpiry } from "../../utils/moderationManager.js";
import { GetProfile } from "../../utils/profileManager.js";

const MAX_TIMEOUT_MS = 2419199000; // 28 days - 1s in milliseconds

// discord only allows 28 days at a time, so a longer mute is extended when it has less than this left
const REFRESH_WHEN_LEFT_MS = 7 * 24 * 60 * 60 * 1000;

const repeating: Repeating = {
	data: {
		immediate: false,
		repeating: true,
		time: 1 * 60 * 60 * 1000,
		clockTime: null,
	},

	async execute(client: Client) {
		for (const [guildId, guild] of client.guilds.cache) {
			if (!guild.members.me?.permissions.has(PermissionFlagsBits.ModerateMembers)) continue;

			const timedOutMembers = guild.members.cache.filter((member) =>
				member.isCommunicationDisabled(),
			);

			for (const member of timedOutMembers.values()) {
				const profile = await GetProfile(member.id, guildId);
				// when the mute ends (Infinity = never, 0 = unmuted), null means we have no record of a mute
				const expiry = GetMuteExpiry(profile);
				if (expiry === null) continue;

				const timeLeft = expiry - Date.now();
				if (timeLeft <= 0) {
					await member.timeout(null, "Timeout should already have been cleared by discord?")
						.catch((err) => console.error(`Failed to remove timeout for ${member.user.username}:`, err));
					continue;
				}
				
				// only longer mutes need this, discords own timeout is enough when it lasts as long as the mute
				const discordEnds = member.communicationDisabledUntilTimestamp ?? 0;
				if (discordEnds >= expiry) continue;
				if (discordEnds - Date.now() > REFRESH_WHEN_LEFT_MS) continue;

				// Refreshes the timeout
				console.log(`Refreshing the timeout of ${member.user.username} (mute ends: ${Number.isFinite(expiry) ? new Date(expiry).toISOString() : "never"})`);
				await member
					.timeout(
						Math.min(timeLeft, MAX_TIMEOUT_MS),
						`Refreshing timeout, Expires at: ${Number.isFinite(expiry) ? new Date(expiry).toISOString() : "never"}`,
					)
					.catch((err) => {
						console.error(
							`Failed to refresh timeout for ${member.user.username}:`,
							err,
						);
					});
			}
		}
	},
};

export default repeating;
