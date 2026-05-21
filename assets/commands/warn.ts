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
	PermissionsBitField,
	SlashCommandBuilder,
} from "discord.js";

const command: Command = {
	data: new SlashCommandBuilder()
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
				.setRequired(true),
		)
		.addBooleanOption((option) =>
			option 
				.setName("announce")
				.setDescription("Whether to send the warning publicly or not")
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

		// Ensure interaction.member is treated as a GuildMember to access permissions
		const executor = interaction.member as GuildMember;

		if (!executor.permissions.has(PermissionsBitField.Flags.MuteMembers)) {
			await interaction.editReply("You don't have permission to use this.");
			return;
		}

		const targetUser = interaction.options.getUser("user", true);
		const reason = interaction.options.getString("reason", true);

		const logChannel = client.channels.cache.get("1499149296203993169") as
			| TextChannel
			| undefined;

		try {
			await targetUser
				.send(
					`## You have been warned from ${interaction.guild?.name}\n` +
						`For: ${reason}\n` +
                        `Please make sure to follow the server rules to avoid further action. If you have any questions, feel free to reach out to the staff team.`,
				)
				.catch(() => {
					console.warn(
						`Could not send DM to ${targetUser.tag} (${targetUser.id}) about their warning.`,
					);
					return;
				});
            
			await interaction.editReply(`**${targetUser.tag}** has been warned.`);

			if (logChannel) {
				await logChannel.send(
					`${interaction.user.tag} has warned <@${targetUser.id}> for the reason: ${reason}`,
				);
			}
		} catch (err) {
			console.error(err);
			await interaction.editReply(
				`An error occurred while trying to warn the user. Please ensure I have the appropriate permissions and try again.\nError: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	},
};

export default command;
