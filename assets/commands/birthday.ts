import {
	type ChatInputCommandInteraction,
	type Client,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from "discord.js";
import { GetAllWithBirthday, GetProfile, UpdateProfile } from "../../utils/profileManager.js";

const set = async (
	interaction: ChatInputCommandInteraction,
	_client: Client,
) => {
	const date = interaction.options.getString("date", true);

	const [year, month, day] = date
		.match(/^(\d{4})-?(\d{2})-?(\d{2})$/)
		?.slice(1)
		.map(Number) || [null, null, null];

	if (!year || !month || !day) {
		await interaction.editReply({
			content: "Invalid date format. Please use YYYY-MM-DD.",
		});
		return;
	}
	if (
		interaction.options.getUser("user")?.id &&
		!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
	) {
		await interaction.editReply({
			content: "You don't have permission to set birthdays for other users.",
		});
		return;
	}

	const userId = interaction.options.getUser("user")?.id || interaction.user.id;
	if (!userId) {
		await interaction.editReply({ content: "User not found." });
		return;
	}
	await UpdateProfile(userId, { birthday: { year, month, day } });
	await interaction.editReply({
		content: `Birthday has been set to ${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
	});
};

const get = async (
	interaction: ChatInputCommandInteraction,
	_client: Client,
) => {
	const profile = await GetProfile(interaction.user.id);
	const birthday = profile?.birthday;

	await interaction.editReply({
		content: birthday
			? `Your birthday is set to ${birthday.year}-${String(birthday.month).padStart(2, "0")}-${String(birthday.day).padStart(2, "0")}`
			: "You haven't set your birthday yet.",
	});
};

const list = async (
	interaction: ChatInputCommandInteraction,
	_client: Client,
) => {
	const users = await GetAllWithBirthday();
	if (users.length === 0) {
		await interaction.editReply({ content: "No birthdays have been set yet." });
		return;
	}
	const formattedList = users
		.map(
			({ id, birthday }) =>
				`<@${id}>: ${birthday?.year}-${String(birthday?.month).padStart(2, "0")}-${String(birthday?.day).padStart(2, "0")}`,
		)
		.join("\n");
	await interaction.editReply({
		content: formattedList,
		allowedMentions: { users: [] },
	});
};

const subcommands = {
	set,
	get,
	list,
} as const;

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("birthday")
		.setDescription("Manage your birthday")
		.addSubcommand((subcommand) =>
			subcommand
				.setName("set")
				.setDescription("Sets your birthday")
				.addStringOption((option) =>
					option
						.setName("date")
						.setDescription("Your birthday (YYYY-MM-DD)")
						.setRequired(true),
				)
				.addUserOption((option) =>
					option
						.setName("user")
						.setDescription("Mod option to set birthday for another user")
						.setRequired(false),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("get")
				.setDescription("Gets your birthday")
				.addStringOption((option) =>
					option
						.setName("date")
						.setDescription("Your birthday (YYYY-MM-DD)")
						.setRequired(true),
				),
		)

		.addSubcommand((subcommand) =>
			subcommand.setName("list").setDescription("Lists all birthdays"),
		),

	async execute(interaction: ChatInputCommandInteraction, client: Client) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const subcommand = interaction.options.getSubcommand();
		const handler = subcommands[subcommand as keyof typeof subcommands];

		if (!handler) {
			// This should never run
			await interaction.editReply(`Unknown subcommand: ${subcommand}`);
			return;
		}

		await handler(interaction, client);
	},
};

export default command;
