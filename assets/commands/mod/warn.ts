import type {
	ChatInputCommandInteraction,
	GuildMember,
	SlashCommandSubcommandBuilder,
} from "discord.js";
import {
	MessageFlags,
	PermissionFlagsBits,
} from "discord.js";
import { SendLog } from "../../../utils/logChannel.js";
import { AddModAction } from "../../../utils/moderationManager.js";
import { CheckHierarchy, HasPermission } from "../../../utils/permissions.js";

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
		)

export default async function command(
	interaction: ChatInputCommandInteraction
) {
	if (!interaction.guild) {
		await interaction.reply({
			content: "This command can only be used in a server.",
			flags: MessageFlags.Ephemeral,
		});
		return;
	}
	if (interaction.options.getBoolean("announce")) {
		await interaction.deferReply();
	} else {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	}

	// Ensure interaction.member is treated as a GuildMember to access permissions
	const executor = interaction.member as GuildMember;

	// a timeout is the moderate members permission, mute members is the voice mute
	if (!(await HasPermission(interaction, PermissionFlagsBits.ModerateMembers))) return;

	const targetUser = interaction.options.getUser("user", true);
	const targetMember = interaction.options.getMember("user") as GuildMember | null;
	const reason = interaction.options.getString("reason", true);

	const denied = targetMember ? CheckHierarchy(executor, targetMember) : null;
	if (denied) {
		await interaction.editReply(denied);
		return;
	}

	try {
		let dmSent = true;
		await targetUser
			.send(
				`## You have received a warning in ${interaction.guild?.name}\n` +
				`**Reason:** ${reason}\n\n` +
				`This is only a warning, but please follow the server rules to avoid further action. If you have any questions, reply to this message and the staff team will see it.`,
			)
			.catch(() => {
				console.warn(
					`Could not send DM to ${targetUser.tag} (${targetUser.id}) about their warning.`,
				);
				dmSent = false;
			});

		// save it in the moderation history
		const caseNumber = await AddModAction(targetUser.id, interaction.guild.id, {
			type: "warn",
			by: interaction.user.id,
			reason,
			...(dmSent ? {} : { dm: false }),
		});

		await interaction.editReply(
			`**${targetUser.tag}** has been warned. (case #${caseNumber ?? "?"})` +
				(caseNumber === null ? "\nI couldn't save the warning in the database, so it is not in their history." : ""),
		);

		await SendLog(interaction.client, interaction.guild.id, `${interaction.user.tag} has warned <@${targetUser.id}> for the reason: ${reason} (case #${caseNumber ?? "?"})`);
	} catch (err) {
		console.error(err);
		await interaction.editReply(
			`An error occurred while trying to warn the user. Please ensure I have the appropriate permissions and try again.\nError: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
};
