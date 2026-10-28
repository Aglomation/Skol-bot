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
import { AddModAction, GetActiveMute } from "../../../utils/moderationManager.js";
import { CheckHierarchy, HasPermission } from "../../../utils/permissions.js";
import { GetProfile } from "../../../utils/profileManager.js";


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
				.setDescription("Whether to send the ban command publicly or not")
				.setRequired(false)
		);

export default async function command(
	interaction: ChatInputCommandInteraction
) {
	if (interaction.options.getBoolean("announce")) {
		await interaction.deferReply();
	} else {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	}
	if (!interaction.guild) {
		await interaction.editReply({
			content: "This command can only be used in a server.",
		});
		return;
	}
	// Ensure interaction.member is treated as a GuildMember to access permissions
	const executor = interaction.member as GuildMember;

	// a timeout is the moderate members permission, mute members is the voice mute
	if (!(await HasPermission(interaction, PermissionFlagsBits.ModerateMembers))) return;

	const user = interaction.options.getUser("user", true);
	const member = interaction.options.getMember("user") as GuildMember | null;
	const reason = interaction.options.getString("reason", true);

	// someone that left can still have a mute going, it is put back when they join, so this is how it is cleared
	const profile = await GetProfile(user.id, interaction.guild.id);
	if (!member && !GetActiveMute(profile)) {
		await interaction.editReply("User is not in this server and has no active mute.");
		return;
	}

	const denied = member ? CheckHierarchy(executor, member) : null;
	if (denied) {
		await interaction.editReply(denied);
		return;
	}

	try {
		await member?.timeout(
			null,
			`Unmuted by ${interaction.user.tag} for the reason: ${reason}`,
		);

		let dmSent = true;
		await user
			.send(
				`## You have been unmuted in ${interaction.guild?.name}\n` +
				`**Reason:** ${reason}\n\n` +
				`You can talk again :D`,
			)
			.catch(() => {
				dmSent = false;
			});

		// save it in the moderation history
		const caseNumber = await AddModAction(user.id, interaction.guild.id, {
			type: "unmute",
			by: interaction.user.id,
			reason,
			...(dmSent ? {} : { dm: false }),
		});

		await interaction.editReply(
			`**${user.tag}** has been unmuted. (case #${caseNumber ?? "?"})` +
				(caseNumber === null ? "\nI couldn't save the unmute in the database, so the history still says they are muted." : "") +
				(member ? "" : "\nThey are not in the server, so they won't be muted when they join."),
		);

		await SendLog(interaction.client, interaction.guild.id, `${interaction.user.tag} has unmuted <@${user.id}> for the reason: ${reason} (case #${caseNumber ?? "?"})`);

	} catch (err) {
		console.error(err);
		await interaction.editReply(
			"I got an error while trying to unmute that user. Make sure my role is high enough (or my code is just bad).",
		);
	}
};
