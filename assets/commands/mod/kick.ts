import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import { SendLog } from "../../../utils/logChannel.js";
import { CheckHierarchy } from "../../../utils/permissions.js";
import { CaseLabel, RecordCase, SendDirectMessage, SERVER_INVITE, StartModRequest } from "./shared.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("kick")
		.setDescription("Removes a user from the server, they can join again")
		.addUserOption((option) =>
			option.setName("user").setDescription("User to kick").setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("reason")
				.setDescription("Reason for the kick")
				.setMaxLength(400)
				.setRequired(true),
		)
		.addBooleanOption((option) =>
			option
				.setName("announce")
				.setDescription("Whether to send the kick command publicly or not")
				.setRequired(false),
		);

export default async function command(interaction: ChatInputCommandInteraction) {
	const request = await StartModRequest(interaction, PermissionFlagsBits.KickMembers);
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

	if (!member.kickable) {
		await interaction.editReply("I cannot kick this user. Their role is higher than or equal to my highest role, or they are the server owner.");
		return;
	}

	try {
		// the dm has to come first, after the kick we share no server with them
		const dmSent = await SendDirectMessage(
			user,
			`## You have been kicked from ${guild.name}\n` +
				`**Reason:** ${reason}\n\n` +
				`You can join the server again: ${SERVER_INVITE}\n` +
				`If you think this is a mistake, reply to this message and the staff team will see it.`,
		);

		await member.kick(`Kicked by ${interaction.user.tag} for the reason: ${reason}`);

		// saved after the kick, so a kick that failed doesn't end up in the history
		const caseNumber = await RecordCase(request, "kick", { dmSent });

		await interaction.editReply(
			`**${user.tag}** has been kicked. (${CaseLabel(caseNumber)})` +
				(caseNumber === null ? "\nI couldn't save the kick in the database, so it is not in their history." : ""),
		);
		await SendLog(interaction.client, guild.id, `${interaction.user.tag} has kicked <@${user.id}> for the reason: ${reason} (${CaseLabel(caseNumber)})`);
	} catch (error) {
		console.error(error);
		await interaction.editReply(`I couldn't kick that user: ${error instanceof Error ? error.message : String(error)}`);
	}
}
