import type { ChatInputCommandInteraction, Guild, GuildMember, SlashCommandSubcommandBuilder } from "discord.js";
import { ChannelType, MessageFlags, PermissionFlagsBits } from "discord.js";
import {
	GiveawayLink,
	StartGiveaway,
} from "../../../features/giveaway.js";
import { ParseDuration } from "../../../utils/duration.js";
import { ExplainError } from "../../../utils/errorText.js";
import { SendLog } from "../../../utils/logChannel.js";
import { HasPermission } from "../../../utils/permissions.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("start")
		.setDescription("Start a giveaway, people enter by pressing a button")
		.addStringOption((option) =>
			option.setName("prize").setDescription("What is given away").setMaxLength(200).setRequired(true),
		)
		.addStringOption((option) =>
			option.setName("duration").setDescription("How long it runs, like 30m, 2h or 1d").setRequired(true),
		)
		.addIntegerOption((option) =>
			option.setName("winners").setDescription("How many winners (default 1)").setMinValue(1),
		)
		.addChannelOption((option) =>
			option
				.setName("channel")
				.setDescription("Where to post it (default: this channel)")
				.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
		)
		.addRoleOption((option) =>
			option.setName("role").setDescription("Only members with this role can enter"),
		);

// what the bot needs in the channel: to post the giveaway, and to answer it with the winners (a reply needs Read Message History)
const NEEDED = [
	[PermissionFlagsBits.ViewChannel, "View Channel"],
	[PermissionFlagsBits.SendMessages, "Send Messages"],
	[PermissionFlagsBits.EmbedLinks, "Embed Links"],
	[PermissionFlagsBits.ReadMessageHistory, "Read Message History"],
] as const;

type GiveawayOptions = { prize: string; winnerCount: number; durationMs: number; roleId: string | null };

/** The options of the command, or what is wrong with them */
function ReadGiveawayOptions(interaction: ChatInputCommandInteraction, guildId: string): GiveawayOptions | { error: string } {
	const prize = interaction.options.getString("prize", true).trim();
	const durationMs = ParseDuration(interaction.options.getString("duration", true));
	const role = interaction.options.getRole("role");

	if (!prize) return { error: "The prize can't be empty." };
	if (durationMs === null || durationMs < 1000) {
		return { error: "The duration has to be atleast 1 second, like `30m`, `2h` or `1d`." };
	}

	return {
		prize,
		winnerCount: interaction.options.getInteger("winners") ?? 1,
		durationMs,
		// the everyone role is every member, so it is not a limit
		roleId: role && role.id !== guildId ? role.id : null,
	};
}

/**
 * The channel the giveaway goes in (the one in the command, or this one), if both the moderator and the bot can use it
 * Tells the moderator what is wrong when not
 */
async function FindPostableChannel(interaction: ChatInputCommandInteraction, guild: Guild) {
	const picked = interaction.options.getChannel("channel");
	const channel = picked ? await guild.channels.fetch(picked.id) : interaction.channel;
	if (!channel?.isTextBased() || channel.isDMBased()) {
		await interaction.editReply("The giveaway has to be posted in a text channel of this server.");
		return null;
	}

	// nobody can use the bot to post where they couldn't post themselves
	if (!channel.permissionsFor(interaction.member as GuildMember)?.has(PermissionFlagsBits.SendMessages)) {
		await interaction.editReply("You can't send messages in that channel.");
		return null;
	}

	const botPermissions = guild.members.me ? channel.permissionsFor(guild.members.me) : null;
	const missing = NEEDED.filter(([flag]) => !botPermissions?.has(flag)).map(([, name]) => name);
	if (missing.length > 0) {
		await interaction.editReply(`I need these permissions in <#${channel.id}>: ${missing.join(", ")}.`);
		return null;
	}

	return channel;
}

export default async function command(interaction: ChatInputCommandInteraction) {
	const guild = interaction.guild;
	if (!guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const options = ReadGiveawayOptions(interaction, guild.id);
	if ("error" in options) {
		await interaction.editReply(options.error);
		return;
	}

	const channel = await FindPostableChannel(interaction, guild);
	if (!channel) return;

	try {
		const giveaway = await StartGiveaway(channel, {
			ownerId: interaction.user.id,
			prize: options.prize,
			winnerCount: options.winnerCount,
			endsAt: Date.now() + options.durationMs,
			roleId: options.roleId,
		});

		await interaction.editReply(`The giveaway is live: ${GiveawayLink(giveaway)}`);
		await SendLog(interaction.client, guild.id, `${interaction.user.tag} started a giveaway for **${options.prize}** in <#${channel.id}>. ${GiveawayLink(giveaway)}`);
	} catch (error) {
		console.error("Could not start a giveaway:", error);
		await interaction.editReply(`I couldn't start the giveaway: ${ExplainError(error)}`);
	}
}
