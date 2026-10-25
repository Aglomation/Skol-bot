import type { ChatInputCommandInteraction, GuildMember, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags } from "discord.js";
import { BuildColorPicker, GetColorRoles, GetCurrentColor } from "../../../utils/colorRoles.js";
import { IsVerified } from "../../../utils/permissions.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand.setName("color").setDescription("Change your color");

export default async function command(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const member = interaction.member as GuildMember;
	if (!(await IsVerified(member))) {
		await interaction.editReply("Du måste vara verifierad för att använda det här kommandot.");
		return;
	}

	const colors = GetColorRoles(interaction.guild);
	if (!colors) {
		await interaction.editReply("Det finns inga färgroller på servern ännu.");
		return;
	}

	await interaction.editReply(BuildColorPicker(colors, GetCurrentColor(member, colors)));
}
