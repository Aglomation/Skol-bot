import type { ChatInputCommandInteraction, GuildMember, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags } from "discord.js";
import { GetServerConfig } from "../../../utils/configManager.js";
import { BuildStep } from "../../../utils/verifyFlow.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("pronouns")
		.setDescription("Change your pronouns");

export default async function command(
	interaction: ChatInputCommandInteraction,
) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	// only verified members, the others use the verify button
	const member = interaction.member as GuildMember;
	const verifiedRoleId = await GetServerConfig(interaction.guild.id, "verifiedRoleId") as string | null;

	if (!verifiedRoleId || !member.roles.cache.has(verifiedRoleId)) {
		await interaction.editReply("Du måste vara verifierad för att använda det här kommandot.");
		return;
	}

	await interaction.editReply(BuildStep("pronouns", [], "roles", true));
}
