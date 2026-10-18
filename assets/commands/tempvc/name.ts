import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags } from "discord.js";
import { GetTempChannel, WithChannelOption } from "./shared.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	WithChannelOption(
		subcommand
			.setName("name")
			.setDescription("Change the name of your temporary voice channel")
			.addStringOption((option) =>
				option
					.setName("name")
					.setDescription("The new name")
					.setMinLength(1)
					.setMaxLength(100)
					.setRequired(true),
			),
	);

export default async function command(
	interaction: ChatInputCommandInteraction,
) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const channel = await GetTempChannel(interaction);
	if (!channel) return;

	const name = interaction.options.getString("name", true);

	try {
		await channel.setName(name);
		await interaction.editReply({ content: `Channel name has been updated to **${name}**.` });
	} catch (error) {
		console.error("Failed to update temporary channel name:", error);
		await interaction.editReply({ content: "An error occurred while trying to apply the setting." });
	}
}
