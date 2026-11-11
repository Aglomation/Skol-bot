import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { FindGiveaway, IsActive, RerollGiveaway } from "../../../features/giveaway.js";
import { ExplainError } from "../../../utils/errorText.js";
import { HasPermission } from "../../../utils/permissions.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("reroll")
		.setDescription("Draw new winners for a giveaway that ended, the old winners can't win again")
		.addStringOption((option) =>
			option.setName("giveaway").setDescription("The giveaway that ended").setAutocomplete(true).setRequired(true),
		)
		.addIntegerOption((option) =>
			option.setName("winners").setDescription("How many new winners (default 1)").setMinValue(1),
		);

export default async function command(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const giveaway = await FindGiveaway(interaction.guild.id, interaction.options.getString("giveaway", true));
	if (!giveaway) {
		await interaction.editReply("I can't find that giveaway, pick one from the list. They are only kept for 7 days after they end.");
		return;
	}
	if (interaction.user.id !== giveaway.ownerId && !(await HasPermission(interaction, PermissionFlagsBits.Administrator))) {
		await interaction.editReply("You can't reroll a giveaway you didn't start.");
		return;
	}
	if (IsActive(giveaway)) {
		await interaction.editReply("That giveaway is still running, use `/giveaway end` to end it first.");
		return;
	}

	try {
		const winners = await RerollGiveaway(interaction.client, giveaway, interaction.options.getInteger("winners") ?? 1);
		await interaction.editReply(winners.length > 0 ? "New winners drawn and announced." : "Nobody else can win, there are no more valid entries.");
	} catch (error) {
		console.error("Could not reroll a giveaway:", error);
		await interaction.editReply(`I couldn't reroll the giveaway: ${ExplainError(error)}`);
	}
}
