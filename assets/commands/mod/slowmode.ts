import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { ChannelType, MessageFlags, PermissionFlagsBits } from "discord.js";
import { ExplainError } from "../../../utils/errorText.js";
import { SendLog } from "../../../utils/logChannel.js";
import { HasPermission } from "../../../utils/permissions.js";

const MAX_SECONDS = 6 * 60 * 60;

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("slowmode")
		.setDescription("Sets how often people can write in a channel")
		.addIntegerOption((option) =>
			option
				.setName("seconds")
				.setDescription("Seconds between messages, 0 turns it off")
				.setMinValue(0)
				.setMaxValue(MAX_SECONDS)
				.setRequired(true),
		)
		.addChannelOption((option) =>
			option
				.setName("channel")
				.setDescription("The channel, default is this one")
				.addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread),
		);

export default async function command(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	if (!(await HasPermission(interaction, PermissionFlagsBits.ManageChannels))) return;

	const seconds = interaction.options.getInteger("seconds", true);
	const picked = interaction.options.getChannel("channel");
	const channel = picked ? interaction.guild.channels.cache.get(picked.id) : interaction.channel;

	if (!channel || !("setRateLimitPerUser" in channel)) {
		await interaction.editReply("Slowmode can only be set in text channels and threads.");
		return;
	}

	try {
		await channel.setRateLimitPerUser(seconds, `Set by ${interaction.user.username}`);

		const text = seconds === 0 ? "turned off" : `set to ${seconds} second${seconds === 1 ? "" : "s"}`;
		await interaction.editReply(`Slowmode in <#${channel.id}> is ${text}.`);
		await SendLog(interaction.client, interaction.guild.id, `<@${interaction.user.id}> ${seconds === 0 ? "turned off" : `set ${seconds}s`} slowmode in <#${channel.id}>.`);
	} catch (error) {
		await interaction.editReply(`I couldn't change the slowmode: ${ExplainError(error)}`);
	}
}
