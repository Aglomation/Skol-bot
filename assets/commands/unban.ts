import {
	type ChatInputCommandInteraction,
	type Client,
	type GuildMember,
	MessageFlags,
	PermissionFlagsBits,
	PermissionsBitField,
	SlashCommandBuilder,
	type TextChannel,
} from "discord.js";
import { GetProfile, UpdateProfile } from "../../utils/profileManager.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("unban")
		.setDescription("Removes a user from the softban list")
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
		.addUserOption((option) =>
			option.setName("user").setDescription("User to unban").setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("reason")
				.setDescription("Reason for the ban")
				.setRequired(true),
		),

	async execute(interaction: ChatInputCommandInteraction, client: Client) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const executor = interaction.member as GuildMember;
		if (!executor.permissions.has(PermissionsBitField.Flags.BanMembers)) {
			await interaction.editReply("You don't have permission to use this.");
			return;
		}

		const user = interaction.options.getUser("user", true);
		const reason = interaction.options.getString("reason", true);
		const profile = await GetProfile(user.id);

		if (interaction.guildId !== "1497140069746741338") {
			await interaction.editReply(
				"This command is restricted for this server.",
			);
			return;
		}

		if (!profile?.banned) {
			await interaction.editReply("That user is not on the ban list.");
			return;
		}

		await UpdateProfile(user.id, {
			banned: false,
			banreason: null,
			banduration: null,
		});

		await interaction.editReply(
			`**${user.tag}** has been removed from the ban list.`,
		);

		const logChannel = client.channels.cache.get("1499149296203993169") as
			| TextChannel
			| undefined;
		if (logChannel) {
			await logChannel.send(
				`${interaction.user.tag} has unbanned <@${user.id}> for the reason: ${reason}`,
			);
		}
	},
};

export default command;
