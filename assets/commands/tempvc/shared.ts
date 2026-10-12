import type {
	AutocompleteInteraction,
	ChatInputCommandInteraction,
	GuildMember,
	SlashCommandSubcommandBuilder,
	VoiceChannel,
} from "discord.js";
import { ChannelType, PermissionFlagsBits } from "discord.js";
import { GetServerConfig } from "../../../utils/configManager.js";

/**
 * Adds the optional channel option, without it the voice channel you are in is used
 * Add it last, discord wants the required options first
 */
export function WithChannelOption(subcommand: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
	return subcommand.addStringOption((option) =>
		option
			.setName("channel")
			.setDescription("Your temporary voice channel (default: the one you are in)")
			.setRequired(false)
			.setAutocomplete(true),
	);
}

/**
 * Finds the temporary voice channel the command is for and checks that they manage it, replies if they dont
 * Needs a deferred reply
 */
export async function GetTempChannel(interaction: ChatInputCommandInteraction): Promise<VoiceChannel | null> {
	if (!interaction.guild) return null;

	const tempChannelId = await GetServerConfig(interaction.guild.id, "tempVcMainChannel");
	const tempCategoryId = await GetServerConfig(interaction.guild.id, "tempvcCategory");

	// the channel they picked, or the one they are in right now
	const channelId = interaction.options.getString("channel");
	const member = interaction.member as GuildMember;
	const channel = channelId ? interaction.guild.channels.cache.get(channelId) : member.voice.channel;

	if (!tempChannelId || !tempCategoryId) {
		await interaction.editReply("Temporary voice channels aren't set up in this server.");
		return null;
	}

	if (
		!channel ||
		channel.type !== ChannelType.GuildVoice ||
		channel.id === tempChannelId ||
		channel.parentId !== tempCategoryId ||
		!channel.permissionsFor(member)?.has(PermissionFlagsBits.MoveMembers) // Acting as an ownership check
	) {
		await interaction.editReply(
			channelId
				? "Invalid channel selected. Please select a valid temporary voice channel that you own."
				: "Join your temporary voice channel first, or pick one with the channel option.",
		);
		return null;
	}

	return channel;
}

/**
 * The autocomplete of the channel option, the temporary channels they manage
 */
export async function ChannelAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
	const guild = interaction.guild;
	if (!guild) return interaction.respond([]);

	const tempChannelId = await GetServerConfig(guild.id, "tempVcMainChannel");
	const tempCategoryId = await GetServerConfig(guild.id, "tempvcCategory");
	if (!tempCategoryId) return interaction.respond([]);

	const focusedValue = interaction.options.getFocused().toLowerCase();
	const member = guild.members.cache.get(interaction.user.id);
	if (!member) return interaction.respond([]);

	const channels = guild.channels.cache
		.filter((channel) =>
			channel.type === ChannelType.GuildVoice &&
			channel.id !== tempChannelId &&
			channel.parentId === tempCategoryId &&
			channel.name.toLowerCase().includes(focusedValue) &&
			channel.permissionsFor(member)?.has(PermissionFlagsBits.MoveMembers),
		)
		.first(25);

	return interaction.respond(channels.map((channel) => ({ name: channel.name, value: channel.id })));
}
