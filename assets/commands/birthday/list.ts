import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags } from "discord.js";
import { GenerateBirthdayPage } from "../../../features/birthdayList.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("list")
		.setDescription("Shows all birthdays")
		.setDescriptionLocalizations({
			"sv-SE": "Visar alla födelsedagar",
		});

export default async function command(interaction: ChatInputCommandInteraction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	if (!interaction.guild) {
		await interaction.editReply({ content: "This command can only be used in a server." });
		return;
	}

	const pageData = await GenerateBirthdayPage(interaction.guild);
	if (!pageData) {
		await interaction.editReply({ content: "No birthdays have been set yet!" });
		return;
	}

	await interaction.editReply(pageData);
}
