import type { GuildMember, PartialGuildMember } from "discord.js";
import { Events } from "discord.js";
import { AddModAction, GetActiveMute, IsTimeoutChangeIgnored } from "../utils/moderationManager.js";
import { GetProfile } from "../utils/profileManager.js";

export default {
	name: Events.GuildMemberUpdate,
	once: false,
	async execute(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
		// only when a timeout that was still going got removed
		const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
		if (!oldTimeout || oldTimeout < Date.now()) return;
		if (newMember.communicationDisabledUntilTimestamp) return;

		// the bot removed it itself (unmute, void...), that gets logged by the command
		if (IsTimeoutChangeIgnored(newMember.id)) return;

		// no active mute in the history means nothing to end
		const profile = await GetProfile(newMember.id, newMember.guild.id);
		if (!GetActiveMute(profile)) return;

		// someone removed it in discord, so end the mute in the history too
		await AddModAction(newMember.id, newMember.guild.id, {
			type: "unmute",
			by: null,
			reason: "Timeout removed in Discord",
		});
	},
};
