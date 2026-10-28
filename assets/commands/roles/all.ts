import type { ChatInputCommandInteraction, GuildMember, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags } from "discord.js";
import { GetServerConfig } from "../../../utils/configManager.js";
import { SendLog } from "../../../utils/logChannel.js";
import { BuildStep } from "../../../utils/verifyFlow.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("all")
		.setDescription("Change your city, class, year and pronoun roles");

export default async function command(
	interaction: ChatInputCommandInteraction,
) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	// only verified members, the others use the verify button
	const member = interaction.member as GuildMember;
	const verifiedRoleId = await GetServerConfig(interaction.guild.id, "verifiedRoleId");

	if (!verifiedRoleId || !member.roles.cache.has(verifiedRoleId)) {
		await interaction.editReply("Du måste vara verifierad för att använda det här kommandot.");
		return;
	}
	SendLog(interaction.client, interaction.guild.id, 
		`User ${member.user.tag} (${member.id}) used the /roles all command.\n
		Previous roles: ${member.roles.cache.map((role) => role.name).join(", ")}\n`
	);
	// the same questions as the verify button, the last step gives the roles straight away
	await interaction.editReply(BuildStep("city", [], "roles"));
}
