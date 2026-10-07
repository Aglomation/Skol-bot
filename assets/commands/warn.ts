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
import { GetServerConfig } from "../../utils/configManager.js";
import { AddModAction } from "../../utils/moderationManager.js";

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
		if (!interaction.guild) {
			await interaction.editReply({
				content: "This command can only be used in a server.",
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

		if (!executor.permissions.has(PermissionsBitField.Flags.MuteMembers)) {
			await interaction.editReply("You don't have permission to use this.");
			return;
		}

		const targetUser = interaction.options.getUser("user", true);
		const reason = interaction.options.getString("reason", true);

		const logChannel = client.channels.cache.get(
			await GetServerConfig(interaction.guild.id, "logChannel") as string
		) as TextChannel | undefined;

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

			await interaction.editReply(`**${targetUser.tag}** has been warned. (case #${caseNumber ?? "?"})`);

			if (logChannel) {
				await logChannel.send(
					`${interaction.user.tag} has warned <@${targetUser.id}> for the reason: ${reason} (case #${caseNumber ?? "?"})`,
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