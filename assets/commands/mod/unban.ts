import type {
	ChatInputCommandInteraction,
	GuildMember,
	SlashCommandSubcommandBuilder,
	TextChannel,
} from "discord.js";
import {
	MessageFlags,
	PermissionsBitField,
} from "discord.js";
import { AddModAction, GetActiveBan } from "../../../utils/moderationManager.js";
import { GetProfile } from "../../../utils/profileManager.js";
import { SendLog } from "../../../utils/logChannel.js";


export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
		.setName("unban")
		.setDescription("Removes a user from the softban list")
		.addUserOption((option) =>
			option.setName("user").setDescription("User to unban").setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("reason")
				.setDescription("Reason for the unban")
				.setMaxLength(400)
				.setRequired(true),
		)

export default async function command(
	interaction: ChatInputCommandInteraction
) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	if (!interaction.guild) {
		await interaction.editReply({
			content: "This command can only be used in a server.",
		});
		return;
	}

	const executor = interaction.member as GuildMember;
	if (!executor.permissions.has(PermissionsBitField.Flags.BanMembers)) {
		await interaction.editReply("You don't have permission to use this.");
		return;
	}

	const user = interaction.options.getUser("user", true);
	const reason = interaction.options.getString("reason", true);
	const profile = await GetProfile(user.id, interaction.guild.id);

	if (!GetActiveBan(profile)) {
		await interaction.editReply("That user is not on the ban list.");
		return;
	}

	let dmSent = true;
	await user
		.send(
			`## Your ban from ${interaction.guild?.name} has been lifted\n` +
				`**Reason:** ${reason}\n\n` +
				`You can join the server again: https://discord.gg/dUYHv8Dv94`,
		)
		.catch(() => {
			dmSent = false;
		});

	// save it in the moderation history
	const caseNumber = await AddModAction(user.id, interaction.guild.id, {
		type: "unban",
		by: interaction.user.id,
		reason,
		...(dmSent ? {} : { dm: false }),
	});

	if (caseNumber === null) {
		await interaction.editReply("I couldn't save the unban in the database, so they are still on the ban list. They may have gotten the dm, try again.");
		return;
	}

	await interaction.editReply(
		`**${user.tag}** has been removed from the ban list. (case #${caseNumber})`,
	);

	await SendLog(interaction.client, interaction.guild.id, `<@${user.id}> has been unbanned by <@${interaction.user.id}> for the reason: ${reason} (case #${caseNumber})`);
};