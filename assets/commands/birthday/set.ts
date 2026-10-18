import type {
	ChatInputCommandInteraction,
	GuildMember,
	SlashCommandSubcommandBuilder,
} from "discord.js";
import { EmbedBuilder, MessageFlags } from "discord.js";
import { FormatBirthday, TodayInSweden } from "../../../utils/birthdayUtils.js";
import { GetServerConfig } from "../../../utils/configManager.js";
import { GetProfile, PROFILE_FAILED, UpdateProfile } from "../../../utils/profileManager.js";
import { AnnounceBirthdays } from "../../repeating/birthday.js";

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
                .setRequired(true),
        );

export default async function set(
	interaction: ChatInputCommandInteraction
) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	const date = interaction.options.getString("date", true);
	const user = interaction.user.id;

	const today = TodayInSweden();
	const currentMonth = today.month;
	const currentDay = today.day;
	const currentYear = today.year;

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


	// no years in the future, and Date.UTC treats the years 0-99 as 1900-1999
	if (year < 1900 || year > currentYear) {
		await interaction.editReply({
			content: "Invalid year.",
		});
		return;
	}

	// Date goes to the next month if the day is invalid for the month, check if the month rolled over.
	// it is saved as midnight UTC, so the day is the same whatever timezone the server or the person is in
	if (new Date(Date.UTC(year, month - 1, day)).getUTCMonth() !== month - 1) {
		await interaction.editReply({
			content: "Invalid date. Please check the day and month combination.",
		});
		return;
	}

	// 2026 - 2008 - (has had birthday this year? 0 : 1) = 18 or 17
	const age = currentYear - year - ((currentMonth < month || (currentMonth === month && currentDay < day)) ? 1 : 0);
	const timestamp = Date.UTC(year, month - 1, day);
	
	// Check if the user is a teacher, then expand the valid age range
	// Valid age range is 13-30 for students, teachers can set any age
	const teacherRoleId = await GetServerConfig(interaction.guild.id, "teacherRoleId");
	const isTeacher = !!teacherRoleId && (interaction.member as GuildMember).roles.cache.has(teacherRoleId);
	if ((age > 30 || age < 13) && !isTeacher){
		await interaction.editReply({
			content: `Invalid year.`,
		});
		return;
	}

	const saved = await UpdateProfile(user, interaction.guild.id, { birthday: Math.floor(timestamp / 1000) });
	if (saved === PROFILE_FAILED) {
		await interaction.editReply({ content: "I couldn't save your birthday, try again later." });
		return;
	}

	const embed = new EmbedBuilder()
		.setTitle("Birthday Set!")
		.setDescription(`Your birthday has been set to ${FormatBirthday(Math.floor(timestamp / 1000))}.\nYou will turn ${age+1} on your next birthday!`)
		.setThumbnail(interaction.user.displayAvatarURL())
		.setFooter({ text: `Use /birthday clear to remove your birthday.` })
		.setColor("Aqua");

	await interaction.editReply({
		embeds: [embed]
	});

	// it is their birthday today, so they get their message now and not just at midnight
	// only theirs, everyone else already got theirs
	if (month === currentMonth && day === currentDay) {
		const profile = await GetProfile(user, interaction.guild.id);
		if (profile) await AnnounceBirthdays(interaction.client, interaction.guild, [profile]);
	}
}
