import type {
	ChatInputCommandInteraction,
	Client,
	GuildMember,
	SlashCommandSubcommandBuilder,
} from "discord.js";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { UpdateProfile } from "../../../utils/profileManager.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
        .setName("set")
        .setDescription("Sets your birthday")
        .setDescriptionLocalizations({
            "sv-SE": "Ändrar din födelsedag",
        })
        .addStringOption((option) =>
            option
                .setName("date")
                .setDescription("Your birthday (YYYY-MM-DD)")
                .setDescriptionLocalizations({
                    "sv-SE": "Din födelsedag (ÅÅÅÅ-MM-DD)",
                })
                .setRequired(false),
        )
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("(Moderator option) to set birthday for another user")
                .setRequired(false),
        );


export default async function set(
	interaction: ChatInputCommandInteraction,
	_client: Client,
) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	const date = interaction.options.getString("date", false);
	const user =
		interaction.options.getUser("user")?.id &&
		interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
			? interaction.options.getUser("user")?.id
			: interaction.user.id;

	if (!user) {
		await interaction.editReply({ content: "User not found." });
		return;
	}

	if (!date) {
		UpdateProfile(user, { birthday: null });
		await interaction.editReply({
			content: "Cleared birthday.",
		});
		return;
	}

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

	await UpdateProfile(user, { birthday: { year, month, day } });
	await interaction.editReply({
		content: `Birthday has been set to ${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
	});
}
