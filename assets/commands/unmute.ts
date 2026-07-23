import type {
	ChatInputCommandInteraction,
	Client,
	GuildMember,
	TextChannel,
} from "discord.js";
import {
	InteractionContextType,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from "discord.js";

import { UpdateProfile } from "../../utils/profileManager.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("unmute")
		.setDescription("Unmutes a user (timeout)")
		.setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
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
		)
		.setContexts(InteractionContextType.Guild)
		.setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers),

	async execute(interaction: ChatInputCommandInteraction, client: Client) {
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

			await UpdateProfile(user.id, interaction.guild.id, { timeout: Date.now() + 0 });

			await user
				.send(
                    `## You have been unmuted from ${interaction.guild?.name}\n` +
                    `Reason: ${reason}`,
                )
				.catch(() => {});

			await interaction.editReply(`**${user.tag}** has been unmuted.`);

            // Logs the unmute
			const logChannel = client.channels.cache.get("1499149296203993169") as
				| TextChannel
				| undefined;
			if (logChannel) {
				await logChannel.send(
					`${interaction.user.tag} has unmuted <@${user.id}> for the reason: ${reason}`,
				);
			}

		} catch (err) {
			console.error(err);
			await interaction.editReply(
				"I got an error while trying to unmute that user. Make sure my role is high enough (or my code is just bad).",
			);
		}
	},
};

export default command;
