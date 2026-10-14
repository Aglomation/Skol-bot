import type { Client } from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import { GetActiveMute, GetModProfiles, TimeoutLength } from "../../utils/moderationManager.js";

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

			// only people the bot has a mute for, a timeout someone else gave in discord is never touched
			const profiles = await GetModProfiles(guildId, ["mute"]);

			for (const profile of profiles) {
				const mute = GetActiveMute({ moderation: profile.actions });
				if (!mute) continue;

				// not in the server, the mute is put back when they join (guildMemberAdd)
				const member = await guild.members.fetch(profile.userId).catch(() => null);
				if (!member) continue;

				// no timeout right now means a moderator took it off in discord, that is not undone here
				const discordEnds = member.communicationDisabledUntilTimestamp ?? 0;
				if (discordEnds <= Date.now()) continue;

				// only longer mutes need this, discords own timeout is enough when it lasts as long as the mute
				const expiry = mute.action.until ?? Infinity;
				if (discordEnds >= expiry) continue;
				if (discordEnds - Date.now() > REFRESH_WHEN_LEFT_MS) continue;

				// Refreshes the timeout
				console.log(`Refreshing the timeout of ${member.user.username} (mute ends: ${Number.isFinite(expiry) ? new Date(expiry).toISOString() : "never"})`);
				await member
					.timeout(
						TimeoutLength(mute.action.until),
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
