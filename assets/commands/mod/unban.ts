import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import { SendLog } from "../../../utils/logChannel.js";
import { GetActiveBan } from "../../../utils/moderationManager.js";
import { GetProfile } from "../../../utils/profileManager.js";
import { RecordCase, SendDirectMessage, SERVER_INVITE, StartModRequest } from "./shared.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("unban")
		.setDescription("Removes a user from the ban list")
		.addUserOption((option) =>
			option.setName("user").setDescription("User to unban").setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("reason")
				.setDescription("Reason for the unban")
				.setMaxLength(400)
				.setRequired(true),
		);

export default async function command(interaction: ChatInputCommandInteraction) {
	const request = await StartModRequest(interaction, PermissionFlagsBits.BanMembers);
	if (!request) return;

	const { user, guild, reason } = request;
	if (!GetActiveBan(await GetProfile(user.id, guild.id))) {
		await interaction.editReply("That user is not on the ban list.");
		return;
	}

	const dmSent = await SendDirectMessage(
		user,
		`## Your ban from ${guild.name} has been lifted\n` + `**Reason:** ${reason}\n\n` + `You can join the server again: ${SERVER_INVITE}`,
	);

	const caseNumber = await RecordCase(request, "unban", { dmSent });
	if (caseNumber === null) {
		await interaction.editReply("I couldn't save the unban in the database, so they are still on the ban list. They may have gotten the dm, try again.");
		return;
	}

	await interaction.editReply(`**${user.tag}** has been removed from the ban list. (case #${caseNumber})`);
	await SendLog(interaction.client, guild.id, `<@${user.id}> has been unbanned by <@${interaction.user.id}> for the reason: ${reason} (case #${caseNumber})`);
}
