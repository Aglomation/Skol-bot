import type { ChatInputCommandInteraction, GuildMember } from "discord.js";
import { GetServerConfig } from "./configManager.js";

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
	if (await GetServerConfig(interaction.guild.id, "isDevServer") === true) return true;

	await interaction.editReply("You don't have permission to use this.");
	return false;
}
