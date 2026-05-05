import {
	type ChatInputCommandInteraction,
	type Client,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from "discord.js";
import { FindByEmail, GetProfile } from "../../utils/profileManager.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("whois")
		.setDescription("UserID -> Email -> UserID")
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addUserOption((option) =>
			option.setName("user").setDescription("User to check").setRequired(false),
		)
		.addStringOption((option) =>
			option
				.setName("email")
				.setDescription("Email to check")
				.setRequired(false),
		),

	async execute(interaction: ChatInputCommandInteraction, _client: Client) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const user = interaction.options.getUser("user");
		const email = interaction.options.getString("email");

		if (user) {
			const result = await GetProfile(user.id);

			await interaction.editReply({
				content: result?.email || `This user doesn't seem to have an email verified.`,
			});
			return;
		}
		if (email) {
			const result = await FindByEmail(email);

			await interaction.editReply({
				content:
					`<@${result?.id}>` || `No user seems to match the email "${email}"`,
			});
			return;
		}
		// add the numbers to list with user id
		await interaction.editReply({
			content: `You need to fill in atleast one of the options!`,
		});
	},
};

export default command;
