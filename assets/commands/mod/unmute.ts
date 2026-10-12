import type {
	ChatInputCommandInteraction,
	GuildMember,
	SlashCommandSubcommandBuilder,
	TextChannel,
} from "discord.js";
import {
	MessageFlags,
	PermissionFlagsBits,
} from "discord.js";
import { GetServerConfig } from "../../../utils/configManager.js";
import { AddModAction } from "../../../utils/moderationManager.js";


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

	if (!executor.permissions.has(PermissionFlagsBits.MuteMembers)) {
		await interaction.editReply("You don't have permission to use this.");
		return;
	}

	const user = interaction.options.getUser("user", true);
	const member = interaction.options.getMember("user") as GuildMember | null;
	const reason = interaction.options.getString("reason", true);

	if (!member) {
		await interaction.editReply("User is not in this server.");
		return;
	}

	try {
		await member.timeout(
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

		await interaction.editReply(`**${user.tag}** has been unmuted. (case #${caseNumber ?? "?"})`);

		const logChannel = interaction.client.channels.cache.get(
			await GetServerConfig(interaction.guild.id, "logChannel") as string
		) as TextChannel | undefined;

		if (logChannel) {
			await logChannel.send(
				`${interaction.user.tag} has unmuted <@${user.id}> for the reason: ${reason} (case #${caseNumber ?? "?"})`,
			);
		}

	} catch (err) {
		console.error(err);
		await interaction.editReply(
			"I got an error while trying to unmute that user. Make sure my role is high enough (or my code is just bad).",
		);
	}
};