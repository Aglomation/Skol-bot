import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags } from "discord.js";
import { GetTempChannel, WithChannelOption } from "./shared.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	WithChannelOption(
		subcommand
			.setName("limit")
			.setDescription("Change how many users can be in your temporary voice channel")
			.addIntegerOption((option) =>
				option
					.setName("users")
					.setDescription("The user limit, 0 is unlimited")
					.setMinValue(0)
					.setMaxValue(99)
					.setRequired(true),
			),
	);

export default async function command(
	interaction: ChatInputCommandInteraction,
) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const channel = await GetTempChannel(interaction);
	if (!channel) return;

	const users = interaction.options.getInteger("users", true);

	try {
		await channel.setUserLimit(users);
		await interaction.editReply({
			content: `User limit for **<#${channel.id}>** has been set to **${users === 0 ? "unlimited" : users}**.`,
		});
	} catch (error) {
		console.error("Failed to update temporary channel user limit:", error);
		await interaction.editReply({ content: "An error occurred while trying to apply the setting." });
	}
}
