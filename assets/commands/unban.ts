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
import { AddModAction, GetActiveBan } from "../../utils/moderationManager.js";
import { GetProfile } from "../../utils/profileManager.js";


const command: Command = {
	data: new SlashCommandBuilder()
		.setName("unban")
		.setDescription("Removes a user from the softban list")
		.addUserOption((option) =>
			option.setName("user").setDescription("User to unban").setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("reason")
				.setDescription("Reason for the ban")
				.setRequired(true),
		)
		.setContexts(InteractionContextType.Guild)
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

	async execute(interaction: ChatInputCommandInteraction, client: Client) {
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

		if (interaction.guildId !== "1497140069746741338") {
			await interaction.editReply(
				"This command is restricted for this server.",
			);
			return;
		}

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

		await interaction.editReply(
			`**${user.tag}** has been removed from the ban list. (case #${caseNumber ?? "?"})`,
		);

		const logChannel = client.channels.cache.get(
			await GetServerConfig(interaction.guild.id, "logChannel") as string
		) as TextChannel | undefined;
		if (logChannel) {
			await logChannel.send(
				`${interaction.user.tag} has unbanned <@${user.id}> for the reason: ${reason} (case #${caseNumber ?? "?"})`,
			);
		}
	},
};

export default command;