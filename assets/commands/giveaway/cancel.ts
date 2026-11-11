import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { CancelGiveaway, FindGiveaway, IsActive } from "../../../features/giveaway.js";
import { SendLog } from "../../../utils/logChannel.js";
import { HasPermission } from "../../../utils/permissions.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("cancel")
		.setDescription("Cancel a giveaway without a winner, its message is deleted")
		.addStringOption((option) =>
			option.setName("giveaway").setDescription("The giveaway to cancel").setAutocomplete(true).setRequired(true),
		);

export default async function command(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const giveaway = await FindGiveaway(interaction.guild.id, interaction.options.getString("giveaway", true));
	if (!giveaway || !IsActive(giveaway)) {
		await interaction.editReply("I can't find a running giveaway like that, pick one from the list.");
		return;
	}
	if (interaction.user.id !== giveaway.ownerId && !(await HasPermission(interaction, PermissionFlagsBits.Administrator))) {
		await interaction.editReply("You can't cancel a giveaway you didn't start.");
		return;
	}
	await CancelGiveaway(interaction.client, giveaway);
	await interaction.editReply("The giveaway was cancelled.");
	await SendLog(interaction.client, interaction.guild.id, `${interaction.user.tag} cancelled the giveaway for **${giveaway.prize}**.`);
}
