import type { ChatInputCommandInteraction, GuildMember } from "discord.js";
import { GetFullServerConfig } from "./configManager.js";

/**
 * Checks if the member is allowed to use a command, replies if they arent
 * Needs a deferred reply
 * Dev servers (isDevServer in the database) skip the check so everything can be tested.
 * A server without a config does NOT skip it, so a missing config never opens up a command
 */
export async function HasPermission(
	interaction: ChatInputCommandInteraction,
	permission: bigint,
): Promise<boolean> {
	if (!interaction.guild) return false;

	const executor = interaction.member as GuildMember;
	if (executor.permissions.has(permission)) return true;
	if ((await GetFullServerConfig(interaction.guild.id, true))?.isDevServer === true) return true;

	await interaction.editReply("You don't have permission to use this.");
	return false;
}

/**
 * Checks if a moderator is allowed to act on a member, nobody can touch someone with the same or a higher top role
 * The server owner can act on anyone, except themselves
 * @returns Why it isn't allowed, null if it is
 */
export function CheckHierarchy(executor: GuildMember, target: GuildMember): string | null {
	if (target.id === executor.id) return "You can't do that to yourself.";
	if (target.id === target.client.user?.id) return "I won't do that to myself.";
	if (target.id === target.guild.ownerId) return "You can't do that to the server owner.";
	if (executor.id === executor.guild.ownerId) return null;

	if (executor.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
		return "Their highest role is the same as or higher than yours.";
	}

	return null;
}

export async function IsVerified(member: GuildMember): Promise<boolean> {
	const config = await GetFullServerConfig(member.guild.id);
	return !!config?.verifiedRoleId && member.roles.cache.has(config.verifiedRoleId);
}
