import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { GuildPremiumTier, MessageFlags } from "discord.js";
import { GetTempChannel, WithChannelOption } from "./shared.js";

function getMaxBitrate(tier: GuildPremiumTier | null | undefined): number {
	switch (tier) {
		case GuildPremiumTier.Tier1: return 128000;
		case GuildPremiumTier.Tier2: return 256000;
		case GuildPremiumTier.Tier3: return 384000;
		default: return 96000;
	}
}

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	WithChannelOption(
		subcommand
			.setName("bitrate")
			.setDescription("Change the audio quality of your temporary voice channel")
			.addIntegerOption((option) =>
				option
					.setName("quality")
					.setDescription("The bitrate, what the server boosts allow is checked")
					.setRequired(true)
					.addChoices(
						{ name: "8000 bps (Very Low)", value: 8000 },
						{ name: "32000 bps", value: 32000 },
						{ name: "64000 bps (Normal)", value: 64000 },
						{ name: "96000 bps", value: 96000 },
						{ name: "128000 bps (High)", value: 128000 },
						{ name: "256000 bps (Ultra)", value: 256000 },
						{ name: "384000 bps (Placebo)", value: 384000 },
					),
			),
	);

export default async function command(
	interaction: ChatInputCommandInteraction,
) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const channel = await GetTempChannel(interaction);
	if (!channel) return;

	const bitrate = interaction.options.getInteger("quality", true);
	const maxBitrate = getMaxBitrate(interaction.guild.premiumTier);

	if (bitrate > maxBitrate) {
		await interaction.editReply({ content: `This server only allows a bitrate up to ${maxBitrate} bps.` });
		return;
	}

	try {
		await channel.setBitrate(bitrate);
		await interaction.editReply({ content: `Bitrate for **<#${channel.id}>** has been set to **${bitrate}** bps.` });
	} catch (error) {
		console.error("Failed to update temporary channel bitrate:", error);
		await interaction.editReply({ content: "An error occurred while trying to apply the setting." });
	}
}
