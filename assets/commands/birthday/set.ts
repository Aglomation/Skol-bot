import type {
	ChatInputCommandInteraction,
	Client,
	GuildMember,
} from "discord.js";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { UpdateProfile } from "../../../utils/profileManager.js";

export default async function set(
	interaction: ChatInputCommandInteraction,
	_client: Client,
) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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

	// Date goes to the next month if the day is invalid for the month, check if the month rolled over.
	if (new Date(year, month - 1, day).getMonth() !== month - 1) {
		await interaction.editReply({
			content: "Invalid date. Please check the day and month combination.",
		});
		return;
	}

	// Check if the user is a teacher, then expand the valid age range
	const isTeacher = (interaction.member as GuildMember).roles.cache.has(
		"1497140069872435217",
	);
	if (
		(year < new Date().getFullYear() - 30 ||
			year > new Date().getFullYear() - 13) &&
		!isTeacher
	) {
		await interaction.editReply({
			content: `Invalid year.`,
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
}
