import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import { SendLog } from "../../../utils/logChannel.js";
import { GetActiveMute } from "../../../utils/moderationManager.js";
import { CheckHierarchy } from "../../../utils/permissions.js";
import { GetProfile } from "../../../utils/profileManager.js";
import { CaseLabel, RecordCase, SendDirectMessage, StartModRequest } from "./shared.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("unmute")
		.setDescription("Unmutes a user (timeout)")
		.addUserOption((option) =>
			option.setName("user").setDescription("User to unmute").setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("reason")
				.setDescription("Reason for the unmute")
				.setMaxLength(400)
				.setRequired(true),
		)
		.addBooleanOption((option) =>
			option
				.setName("announce")
				.setDescription("Whether to send the unmute command publicly or not")
				.setRequired(false)
		);

export default async function command(interaction: ChatInputCommandInteraction) {
	const request = await StartModRequest(interaction, PermissionFlagsBits.ModerateMembers);
	if (!request) return;

	const { member, user, guild, reason } = request;

	// someone who left can still have a mute going (it is put back when they join), this is how it is cleared
	const profile = await GetProfile(user.id, guild.id);
	if (!member && !GetActiveMute(profile)) {
		await interaction.editReply("User is not in this server and has no active mute.");
		return;
	}

	const hierarchyError = member ? CheckHierarchy(request.moderator, member) : null;
	if (hierarchyError) {
		await interaction.editReply(hierarchyError);
		return;
	}

	try {
		await member?.timeout(null, `Unmuted by ${interaction.user.tag} for the reason: ${reason}`);

		const dmSent = await SendDirectMessage(user, `## You have been unmuted in ${guild.name}\n**Reason:** ${reason}\n\nYou can talk again :D`);
		const caseNumber = await RecordCase(request, "unmute", { dmSent });

		await interaction.editReply(
			`**${user.tag}** has been unmuted. (${CaseLabel(caseNumber)})` +
				(caseNumber === null ? "\nI couldn't save the unmute in the database, so the history still says they are muted." : "") +
				(member ? "" : "\nThey are not in the server, so they won't be muted when they join."),
		);
		await SendLog(interaction.client, guild.id, `${interaction.user.tag} has unmuted <@${user.id}> for the reason: ${reason} (${CaseLabel(caseNumber)})`);
	} catch (error) {
		console.error(error);
		await interaction.editReply("I got an error while trying to unmute that user. Make sure my role is high enough (or my code is just bad).");
	}
}
