import type { ChatInputCommandInteraction, Guild, GuildMember, GuildTextBasedChannel, User } from "discord.js";
import { MessageFlags } from "discord.js";
import type { ModActionType } from "../../../db/schema.js";
import { SendLog } from "../../../utils/logChannel.js";
import { AddModAction } from "../../../utils/moderationManager.js";
import { HasPermission } from "../../../utils/permissions.js";
import { PurgeChannels } from "../../../utils/purgeMessages.js";

export const SERVER_INVITE = "https://discord.gg/dUYHv8Dv94";

export const INVALID_DURATION = "Invalid duration format. Make sure to follow the format!\nExample: `1h` for 1 hour, `30m` for 30 minutes, `inf` for indefinite.";

// The choices of the deletemessages option in /mod ban and /mod mute, the values are read by ParseDuration
export const DELETE_MESSAGES_CHOICES = [
	{ name: "None", value: "0" },
	{ name: "1 Hour", value: "1h" },
	{ name: "3 Hours", value: "3h" },
	{ name: "6 Hours", value: "6h" },
	{ name: "12 Hours", value: "12h" },
	{ name: "1 Day", value: "24h" },
	{ name: "2 Days", value: "48h" },
];

/** What every moderation command knows once it has read the command: who does what to whom, and why. */
export type ModRequest = {
	interaction: ChatInputCommandInteraction;
	guild: Guild;
	moderator: GuildMember;
	user: User;
	/** The same person as a server member, null if they are not in the server. */
	member: GuildMember | null;
	reason: string;
};

/**
 * Defers the reply, public if the announce option is on and only for the moderator if not
 */
export async function DeferReply(interaction: ChatInputCommandInteraction): Promise<void> {
	await interaction.deferReply(interaction.options.getBoolean("announce") ? {} : { flags: MessageFlags.Ephemeral });
}

/**
 * The start that all the moderation commands share: reply setup, permission check, and reading the user and the reason
 * @returns null when the command has already been answered (not in a server, or not allowed)
 */
export async function StartModRequest(interaction: ChatInputCommandInteraction, permission: bigint): Promise<ModRequest | null> {
	await DeferReply(interaction);
	if (!interaction.guild) {
		await interaction.editReply("This command can only be used in a server.");
		return null;
	}
	if (!(await HasPermission(interaction, permission))) return null;

	return {
		interaction,
		guild: interaction.guild,
		moderator: interaction.member as GuildMember,
		user: interaction.options.getUser("user", true),
		member: interaction.options.getMember("user") as GuildMember | null,
		reason: interaction.options.getString("reason", true),
	};
}

/**
 * Sends a DM, false if it couldn't be delivered (closed DMs, blocked the bot...)
 */
export async function SendDirectMessage(user: User, text: string): Promise<boolean> {
	return await user.send(text).then(
		() => true,
		() => false,
	);
}

/** When something ends, as a unix timestamp in seconds (null if it never does), what discord's <t:> tags want */
export function ExpiresAt(durationMs: number): number | null {
	return Number.isFinite(durationMs) ? Math.floor((Date.now() + durationMs) / 1000) : null;
}

/** The end of a punishment as the person gets it in the DM */
export function DescribeEnd(expiresAt: number | null): string {
	return expiresAt ? `<t:${expiresAt}:F> (<t:${expiresAt}:R>)` : "Never (permanent)";
}

/** The end of a punishment as the staff gets it in the log */
export function DescribeEndForLog(expiresAt: number | null): string {
	return expiresAt ? `<t:${expiresAt}>` : "Indefinite";
}

/** The case number as text, "?" if it couldn't be saved */
export const CaseLabel = (caseNumber: number | null): string => `case #${caseNumber ?? "?"}`;

/**
 * Saves what the moderator did in the history of the user
 * @returns The case number, null if it couldn't be saved
 */
export async function RecordCase(
	request: ModRequest,
	type: ModActionType,
	options: { dmSent: boolean; until?: number | null },
): Promise<number | null> {
	return await AddModAction(request.user.id, request.guild.id, {
		type,
		by: request.interaction.user.id,
		reason: request.reason,
		...("until" in options ? { until: options.until } : {}),
		...(options.dmSent ? {} : { dm: false }),
	});
}

/**
 * The text channels the member can see, for deleting their messages
 * Read this before the member is kicked, afterwards we can't tell what they could see
 */
export function FindChannelsToPurge(member: GuildMember | null, purgeDurationMs: number | null): GuildTextBasedChannel[] {
	if (!member || !purgeDurationMs || purgeDurationMs <= 0) return [];

	return member.guild.channels.cache
		.filter((channel) => channel.isTextBased() && channel.permissionsFor(member)?.has("ViewChannel"))
		.map((channel) => channel as GuildTextBasedChannel);
}

/**
 * Deletes the messages of the user in the channels, and tells the log how many
 * @param action What the punishment was, for the log
 */
export async function PurgeAndLog(
	request: ModRequest,
	channels: GuildTextBasedChannel[],
	purgeDurationMs: number | null,
	action: "ban" | "mute",
): Promise<void> {
	if (channels.length === 0 || !purgeDurationMs) return;

	const deletedPerChannel = await PurgeChannels(channels, request.user.id, purgeDurationMs);
	const total = deletedPerChannel.reduce((sum, count) => sum + count, 0);
	await SendLog(request.interaction.client, request.guild.id, `Deleted ${total} messages from <@${request.user.id}> as part of the ${action}.`);
}
