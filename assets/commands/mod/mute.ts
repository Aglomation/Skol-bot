import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import { ParseDuration } from "../../../utils/duration.js";
import { SendLog } from "../../../utils/logChannel.js";
import { TimeoutLength, UntilFromDuration } from "../../../utils/moderationManager.js";
import { CheckHierarchy } from "../../../utils/permissions.js";
import {
	CaseLabel,
	DELETE_MESSAGES_CHOICES,
	DescribeEnd,
	DescribeEndForLog,
	ExpiresAt,
	FindChannelsToPurge,
	INVALID_DURATION,
	PurgeAndLog,
	RecordCase,
	SendDirectMessage,
	StartModRequest,
} from "./shared.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("mute")
		.setDescription("Mutes a user (timeout)")
		.addUserOption((option) =>
			option.setName("user").setDescription("User to mute").setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("reason")
				.setDescription("Reason for the mute")
				.setMaxLength(400)
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("duration")
				.setDescription(
					"Duration of the mute (s, m, h, d, w, mo, y, inf) [mutes >28d gets refreshed until <28d]",
				)
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("deletemessages")
				.setDescription("Whether to delete the user's messages")
				.setRequired(false)
				.setChoices(...DELETE_MESSAGES_CHOICES),
		)
		.addBooleanOption((option) =>
			option
				.setName("announce")
				.setDescription("Whether to send the mute command publicly or not")
				.setRequired(false)
		);

export default async function command(interaction: ChatInputCommandInteraction) {
	// a timeout is the moderate members permission, "mute members" is the voice mute
	const request = await StartModRequest(interaction, PermissionFlagsBits.ModerateMembers);
	if (!request) return;

	const { member, user, guild, reason } = request;
	if (!member) {
		await interaction.editReply("User is not in this server.");
		return;
	}

	const hierarchyError = CheckHierarchy(request.moderator, member);
	if (hierarchyError) {
		await interaction.editReply(hierarchyError);
		return;
	}

	const durationMs = ParseDuration(interaction.options.getString("duration") ?? "");
	if (!durationMs) {
		await interaction.editReply(INVALID_DURATION);
		return;
	}
	const purgeDurationMs = ParseDuration(interaction.options.getString("deletemessages") ?? "");

	try {
		// a timeout can't be longer than 28 days, a longer mute is renewed by the bot later (TimeoutLength)
		await member.timeout(TimeoutLength(UntilFromDuration(durationMs)), reason);
		const expiresAt = ExpiresAt(durationMs);

		const dmSent = await SendDirectMessage(
			user,
			`## You have been muted in ${guild.name}\n` +
				`**Reason:** ${reason}\n` +
				`**Ends:** ${DescribeEnd(expiresAt)}\n\n` +
				`Until then you can't send messages, react or speak in voice channels. If you think this is a mistake, reply to this message and the staff team will see it.`,
		);

		const caseNumber = await RecordCase(request, "mute", { dmSent, until: UntilFromDuration(durationMs) });

		await interaction.editReply(
			`**${user.tag}** has been muted. (${CaseLabel(caseNumber)})` +
				(caseNumber === null ? "\nI couldn't save the mute in the database, so it won't be refreshed or put back if they leave and join again." : ""),
		);
		await SendLog(interaction.client, guild.id, `${interaction.user.tag} has muted <@${user.id}> until: ${DescribeEndForLog(expiresAt)} for the reason: ${reason} (${CaseLabel(caseNumber)})`);

		await PurgeAndLog(request, FindChannelsToPurge(member, purgeDurationMs), purgeDurationMs, "mute");
	} catch (error) {
		console.error(error);
		await interaction.editReply("I got an error while trying to mute that user. Make sure my role is high enough (or my code is just bad).");
	}
}
