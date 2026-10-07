import type { GuildMember, PartialGuildMember } from "discord.js";
import { AuditLogEvent, Events } from "discord.js";
import { AddModAction, GetActiveMute } from "../utils/moderationManager.js";
import { GetProfile } from "../utils/profileManager.js";

/**
 * Looks in the audit log for who removed the timeout
 * @returns The id of who did it, or null if not found
 */
async function FindExecutor(member: GuildMember): Promise<string | null> {
	try {
		const logs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 10 });

		const entry = logs.entries.find(
			(log) =>
				log.targetId === member.id &&
				Date.now() - log.createdTimestamp < 15 * 1000 &&
				log.changes.some((change) => change.key === "communication_disabled_until"),
		);

		return entry?.executorId ?? null;
	} catch {
		return null;
	}
}

export default {
	name: Events.GuildMemberUpdate,
	once: false,
	async execute(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
		// only when a timeout that was still going got removed
		const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
		if (!oldTimeout || oldTimeout < Date.now()) return;
		if (newMember.communicationDisabledUntilTimestamp) return;

		// little delay incase discord is slow.
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// looks at the audit log.
		const executorId = await FindExecutor(newMember);
		if (executorId && executorId === newMember.client.user?.id) return;

		// no active mute in the history means nothing to end (also covers the bots own commands)
		const profile = await GetProfile(newMember.id, newMember.guild.id);
		if (!GetActiveMute(profile)) return;

		// someone removed it in discord, so end the mute in the history too
		await AddModAction(newMember.id, newMember.guild.id, {
			type: "unmute",
			by: executorId,
			reason: "Timeout removed manually in Discord",
		});
	},
};
