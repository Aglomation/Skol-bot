import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import { ParseDuration } from "../../../utils/duration.js";
import { SendLog } from "../../../utils/logChannel.js";
import { GetActiveBan, UntilFromDuration } from "../../../utils/moderationManager.js";
import { CheckHierarchy } from "../../../utils/permissions.js";
import { GetProfile } from "../../../utils/profileManager.js";
import type { ModRequest } from "./shared.js";
import {
	DELETE_MESSAGES_CHOICES,
	DescribeEnd,
	DescribeEndForLog,
	ExpiresAt,
	FindChannelsToPurge,
	INVALID_DURATION,
	PurgeAndLog,
	RecordCase,
	SendDirectMessage,
	SERVER_INVITE,
	StartModRequest,
} from "./shared.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("ban")
		.setDescription("Bans a user from the server (ban)")
		.addUserOption((option) =>
			option
				.setName("user")
				.setDescription("User to ban")
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("reason")
				.setDescription("Reason for the ban")
				.setMaxLength(400)
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("duration")
				.setDescription("Duration of the ban (s, m, h, d, w, mo, y, inf)")
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
				.setDescription("Whether to send the ban command publicly or not")
				.setRequired(false)
		);

/** A ban once the options are read and checked */
type BanRequest = ModRequest & {
	durationMs: number;
	/** Unix seconds, null for a permanent ban */
	expiresAt: number | null;
	purgeDurationMs: number | null;
};

export default async function command(interaction: ChatInputCommandInteraction) {
	const request = await StartModRequest(interaction, PermissionFlagsBits.BanMembers);
	if (!request) return;

	const hierarchyError = request.member ? CheckHierarchy(request.moderator, request.member) : null;
	if (hierarchyError) {
		await interaction.editReply(hierarchyError);
		return;
	}

	const durationMs = ParseDuration(interaction.options.getString("duration") ?? "");
	if (!durationMs) {
		await interaction.editReply(INVALID_DURATION);
		return;
	}

	const ban: BanRequest = {
		...request,
		durationMs,
		expiresAt: ExpiresAt(durationMs),
		purgeDurationMs: ParseDuration(interaction.options.getString("deletemessages") ?? ""),
	};

	const profile = await GetProfile(ban.user.id, ban.guild.id);
	if (GetActiveBan(profile)) {
		await ChangeExistingBan(ban);
	} else {
		await CreateBan(ban);
	}
}

/**
 * The user is already banned, so the new duration and reason replace the old ones (the old ban stays in the history)
 */
async function ChangeExistingBan(ban: BanRequest) {
	const { interaction, guild, user, member, reason, durationMs, expiresAt } = ban;

	// the dm goes first so the case can say if it arrived
	const dmSent = await SendDirectMessage(
		user,
		`## Your ban on ${guild.name} has been changed\n` +
			`**New reason:** ${reason}\n` +
			`**Now ends:** ${DescribeEnd(expiresAt)}\n\n` +
			`You still can't join the server while the ban is active. If you think this is a mistake, reply to this message and the staff team will see it.`,
	);

	const caseNumber = await RecordCase(ban, "softban", {
		dmSent,
		until: UntilFromDuration(durationMs),
	});
	if (caseNumber === null) {
		await interaction.editReply("I couldn't save the change in the database, so the ban is the same as before. They may have gotten the dm, try again.");
		return;
	}

	// someone with an active ban shouldn't be in the server, it happens if they joined while the bot or the database was down
	let stillInServerNote = "";
	if (member) {
		stillInServerNote = await member.kick(reason).then(
			() => "\nThey were still in the server, so I kicked them.",
			() => "\nThey are still in the server and I couldn't kick them, do it by hand.",
		);
	}

	await interaction.editReply(`User is already on the ban list. Edited their ban instead. (case #${caseNumber})${stillInServerNote}`);
	await SendLog(interaction.client, guild.id, `${interaction.user.tag} has edited the ban of <@${user.id}>, now until: ${DescribeEndForLog(expiresAt)} for the reason: ${reason} (case #${caseNumber})`);
}

/**
 * Bans someone who isn't banned yet
 * A "ban" here is a saved case plus a kick: the bot kicks anyone with an active ban when they join, which avoids a real (IP) ban
 */
async function CreateBan(ban: BanRequest) {
	const { interaction, guild, user, member, reason, durationMs, expiresAt, purgeDurationMs } = ban;

	// not in the server is fine, it is a ban in advance and they are kicked when they join
	if (member && !member.kickable) {
		await interaction.editReply("I cannot ban this user. Their role is higher than or equal to my highest role, or they are the server owner.");
		return;
	}

	try {
		const dmSent = await SendDirectMessage(
			user,
			`## You have been banned from ${guild.name}\n` +
				`**Reason:** ${reason}\n` +
				`**Ends:** ${DescribeEnd(expiresAt)}\n\n` +
				`You can't join the server while the ban is active. If you think this is a mistake, reply to this message and the staff team will see it.` +
				(expiresAt ? `\nYou can rejoin when it ends: ${SERVER_INVITE}` : ""),
		);

		const channelsToPurge = FindChannelsToPurge(member, purgeDurationMs);

		// saved before the kick, so they can't rejoin in between
		const caseNumber = await RecordCase(ban, "softban", { dmSent, until: UntilFromDuration(durationMs) });
		if (caseNumber === null) {
			// without a saved case there is no ban, they would be able to join again
			await interaction.editReply("I couldn't save the ban in the database, so I didn't kick them. They may have gotten the ban dm, try again.");
			return;
		}

		// the ban is saved, so if the kick fails they are kicked the next time they join
		const kickFailed = member ? await member.kick(reason).then(() => false, (error) => {
			console.error(`Could not kick ${user.tag} after saving the ban:`, error);
			return true;
		}) : false;

		await interaction.editReply(
			`**${user.tag}** has been banned. (case #${caseNumber})` +
				(member ? "" : "\nThey are not in the server, they will be kicked if they join.") +
				(kickFailed ? "\nThe ban is saved but I couldn't kick them, do it by hand." : ""),
		);
		await SendLog(interaction.client, guild.id, `${interaction.user.tag} has banned <@${user.id}> until: ${DescribeEndForLog(expiresAt)} for the reason: ${reason} (case #${caseNumber})`);

		await PurgeAndLog(ban, channelsToPurge, purgeDurationMs, "ban");
	} catch (error) {
		console.error(error);
		await interaction.editReply(
			`An error occurred while trying to ban the user. Please ensure I have the appropriate permissions and try again.\nError: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}
