import type { ChatInputCommandInteraction, GuildMember, SlashCommandSubcommandBuilder } from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import { SendLog } from "../../../utils/logChannel.js";
import { AddModAction } from "../../../utils/moderationManager.js";
import { CheckHierarchy, HasPermission } from "../../../utils/permissions.js";
import { DeferReply, SERVER_INVITE } from "./shared.js";

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
	await DeferReply(interaction);
	if (!interaction.guild) {
		await interaction.editReply("This command can only be used in a server.");
		return;
	}

	if (!(await HasPermission(interaction, PermissionFlagsBits.KickMembers))) return;

	const user = interaction.options.getUser("user", true);
	const member = interaction.options.getMember("user") as GuildMember | null;
	const reason = interaction.options.getString("reason", true);

	if (!member) {
		await interaction.editReply("User is not in this server.");
		return;
	}

	const denied = CheckHierarchy(interaction.member as GuildMember, member);
	if (denied) {
		await interaction.editReply(denied);
		return;
	}

	if (!member.kickable) {
		await interaction.editReply("I cannot kick this user. Their role is higher than or equal to my highest role, or they are the server owner.");
		return;
	}

	try {
		// the dm has to come first, after the kick we share no server with them
		let dmSent = true;
		await user
			.send(
				`## You have been kicked from ${interaction.guild.name}\n` +
					`**Reason:** ${reason}\n\n` +
					`You can join the server again: ${SERVER_INVITE}\n` +
					`If you think this is a mistake, reply to this message and the staff team will see it.`,
			)
			.catch(() => {
				dmSent = false;
			});

		await member.kick(`Kicked by ${interaction.user.tag} for the reason: ${reason}`);

		// it is saved after the kick, so a kick that failed doesn't end up in the history
		const caseNumber = await AddModAction(user.id, interaction.guild.id, {
			type: "kick",
			by: interaction.user.id,
			reason,
			...(dmSent ? {} : { dm: false }),
		});

		await interaction.editReply(
			`**${user.tag}** has been kicked. (case #${caseNumber ?? "?"})` +
				(caseNumber === null ? "\nI couldn't save the kick in the database, so it is not in their history." : ""),
		);

		await SendLog(interaction.client, interaction.guild.id, `${interaction.user.tag} has kicked <@${user.id}> for the reason: ${reason} (case #${caseNumber ?? "?"})`);
	} catch (err) {
		console.error(err);
		await interaction.editReply(`I couldn't kick that user: ${err instanceof Error ? err.message : String(err)}`);
	}
}
