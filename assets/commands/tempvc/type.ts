import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags } from "discord.js";
import { GetTempChannel, WithChannelOption } from "./shared.js";

// The channel flag for spoilers (flags: ChannelFlagsBitField { bitfield: 2097152 })
const SPOILER_FLAG = 1 << 21;

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	WithChannelOption(
		subcommand
			.setName("type")
			.setDescription("Mark your temporary voice channel as normal, spoiler or NSFW")
			.addStringOption((option) =>
				option
					.setName("type")
					.setDescription("The type of the channel")
					.setRequired(true)
					.addChoices(
						{ name: "Normal", value: "normal" },
						{ name: "Spoiler", value: "spoiler" },
						{ name: "NSFW", value: "nsfw" },
					),
			),
	);

export default async function command(
	interaction: ChatInputCommandInteraction,
) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const channel = await GetTempChannel(interaction);
	if (!channel) return;

	const type = interaction.options.getString("type", true);

	try {
		switch (type) {
			case "normal":
				await channel.edit({ nsfw: false, flags: 0 });
				break;
			case "spoiler":
				await channel.edit({ nsfw: false, flags: SPOILER_FLAG });
				break;
			case "nsfw":
				await channel.edit({ nsfw: true, flags: 0 });
				break;
			default:
				await interaction.editReply({ content: "Invalid type. Please choose from Normal, NSFW, or Spoiler." });
				return;
		}

		await interaction.editReply({ content: `Type for **<#${channel.id}>** has been set to **${type}**.` });
	} catch (error) {
		console.error("Failed to update temporary channel type:", error);
		await interaction.editReply({ content: "An error occurred while trying to apply the setting." });
	}
}
