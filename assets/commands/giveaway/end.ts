import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { FindGiveaway, FinishGiveaway, IsActive } from "../../../features/giveaway.js";
import { ExplainError } from "../../../utils/errorText.js";
import { HasPermission } from "../../../utils/permissions.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("end")
		.setDescription("End a giveaway now and draw the winners")
		.addStringOption((option) =>
			option.setName("giveaway").setDescription("The giveaway to end").setAutocomplete(true).setRequired(true),
		);

export default async function command(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	
	const giveaway = await FindGiveaway(interaction.guild.id, interaction.options.getString("giveaway", true));
	if (!giveaway) {
		await interaction.editReply("I can't find that giveaway, pick one from the list.");
		return;
	}
	if (!IsActive(giveaway)) {
		await interaction.editReply("That giveaway has already ended, use `/giveaway reroll` to draw a new winner.");
		return;
	}
	if (interaction.user.id !== giveaway.ownerId && !(await HasPermission(interaction, PermissionFlagsBits.Administrator))) {
		await interaction.editReply("You can't end a giveaway you didn't start.");
		return;
	}
	try {
		const winners = await FinishGiveaway(interaction.client, giveaway);
		if (winners === null) {
			await interaction.editReply("That giveaway is being ended right now.");
			return;
		}

		await interaction.editReply(winners.length > 0 ? `Giveaway ended, ${winners.length} winner${winners.length === 1 ? "" : "s"} drawn.` : "Giveaway ended, but there were no valid entries.");
	} catch (error) {
		console.error("Could not end a giveaway:", error);
		await interaction.editReply(`I couldn't end the giveaway: ${ExplainError(error)}`);
	}
}
