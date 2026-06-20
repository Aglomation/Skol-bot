import type {
	ChatInputCommandInteraction,
	Client,
	GuildMember,
	SlashCommandSubcommandBuilder,
} from "discord.js";
import { EmbedBuilder, MessageFlags } from "discord.js";
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
        );

export default async function set(
	interaction: ChatInputCommandInteraction,
	_client: Client,
) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	const date = interaction.options.getString("date", false);
	const user = interaction.user.id;

	const today = new Date();
	const currentMonth = today.getMonth() + 1;
	const currentDay = today.getDate();
	const currentYear = today.getFullYear();

	if (!user) {
		await interaction.editReply({ content: "User not found." });
		return;
	}

	if (!date) {
		await UpdateProfile(user, { birthday: null });
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

	// 2026 - 2008 - (has had birthday this year? 0 : 1) = 18 or 17
	const age = currentYear - year - ((currentMonth < month || (currentMonth === month && currentDay < day)) ? 1 : 0);
	const timestamp = new Date(year, month - 1, day).getTime();
	
	// Check if the user is a teacher, then expand the valid age range
	// Valid age range is 13-30 for students, teachers can set any age
	const isTeacher = (interaction.member as GuildMember).roles.cache.has(
		"1497140069872435217",
	);
	if ((age > 30 || age < 13) && !isTeacher){
		await interaction.editReply({
			content: `Invalid year.`,
		});
		return;
	}

	await UpdateProfile(user, { birthday: Math.floor(timestamp / 1000) });

	const embed = new EmbedBuilder()
		.setTitle("Birthday Set!")
		.setDescription(`Your birthday has been set to <t:${Math.floor(timestamp / 1000)}:D>.\nYou will turn ${age+1} on your next birthday!`)
		.setThumbnail(interaction.user.displayAvatarURL())
		.setFooter({ text: `Use /birthday set without a date to clear your birthday.` })
		.setColor("Aqua");

	await interaction.editReply({
		embeds: [embed]
	});
}
