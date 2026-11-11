import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import { SendLog } from "../../../utils/logChannel.js";
import { CheckHierarchy } from "../../../utils/permissions.js";
import { CaseLabel, RecordCase, SendDirectMessage, StartModRequest } from "./shared.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("warn")
		.setDescription("Warns a user in the server")
		.addUserOption((option) =>
			option
				.setName("user")
				.setDescription("User to warn")
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("reason")
				.setDescription("Reason for the warning")
				.setMaxLength(400)
				.setRequired(true),
		)
		.addBooleanOption((option) =>
			option
				.setName("announce")
				.setDescription("Whether to send the warning publicly or not")
				.setRequired(false)
		);

export default async function command(interaction: ChatInputCommandInteraction) {
	const request = await StartModRequest(interaction, PermissionFlagsBits.ModerateMembers);
	if (!request) return;

	const { member, user, guild, reason } = request;
	const hierarchyError = member ? CheckHierarchy(request.moderator, member) : null;
	if (hierarchyError) {
		await interaction.editReply(hierarchyError);
		return;
	}

	try {
		const dmSent = await SendDirectMessage(
			user,
			`## You have received a warning in ${guild.name}\n` +
				`**Reason:** ${reason}\n\n` +
				`This is only a warning, but please follow the server rules to avoid further action. If you have any questions, reply to this message and the staff team will see it.`,
		);
		const caseNumber = await RecordCase(request, "warn", { dmSent });

		await interaction.editReply(
			`**${user.tag}** has been warned. (${CaseLabel(caseNumber)})` +
				(caseNumber === null ? "\nI couldn't save the warning in the database, so it is not in their history." : ""),
		);
		await SendLog(interaction.client, guild.id, `${interaction.user.tag} has warned <@${user.id}> for the reason: ${reason} (${CaseLabel(caseNumber)})`);
	} catch (error) {
		console.error(error);
		await interaction.editReply(
			`An error occurred while trying to warn the user. Please ensure I have the appropriate permissions and try again.\nError: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}
