import type {
	ChatInputCommandInteraction,
	GuildMember,
	SlashCommandSubcommandBuilder,
} from "discord.js";
import { EmbedBuilder, MessageFlags } from "discord.js";
import type { BirthdayDate } from "../../../features/birthdays.js";
import { AgeToday, AnnounceBirthdays, CompareDates, FormatBirthday, HIDDEN_YEAR, TodayInSweden } from "../../../features/birthdays.js";
import { GetServerConfig } from "../../../utils/configManager.js";
import { GetProfile, PROFILE_FAILED, UpdateProfile } from "../../../utils/profileManager.js";

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
		)
		.addBooleanOption((option) =>
			option
				.setName("hide_year")
				.setDescription("Don't save or show your birth year and age")
				.setDescriptionLocalizations({
					"sv-SE": "Spara och visa inte ditt födelseår och din ålder",
				}),
		);

const OLDEST_YEAR = 1900;
// students have to be this old, teachers can set any age
const MIN_STUDENT_AGE = 13;
const MAX_STUDENT_AGE = 30;

/**
 * The date from "2008-05-17" (or "20080517"), or what is wrong with it
 */
function ParseBirthday(input: string, currentYear: number): BirthdayDate | { error: string } {
	const [year, month, day] = input.match(/^(\d{4})-?(\d{2})-?(\d{2})$/)?.slice(1).map(Number) || [null, null, null];

	if (!year || !month || !day) return { error: "Invalid date format. Please use YYYY-MM-DD." };

	// no years in the future, and Date.UTC treats the years 0-99 as 1900-1999
	if (year < OLDEST_YEAR || year > currentYear) return { error: "Invalid year." };

	// Date goes to the next month if the day is invalid for the month, check if the month rolled over.
	if (new Date(Date.UTC(year, month - 1, day)).getUTCMonth() !== month - 1) {
		return { error: "Invalid date. Please check the day and month combination." };
	}

	return { year, month, day };
}

function BuildConfirmation(interaction: ChatInputCommandInteraction, savedTimestamp: number, hideYear: boolean, ageNow: number) {
	const dateText = FormatBirthday(savedTimestamp);

	return new EmbedBuilder()
		.setTitle("Birthday Set!")
		.setDescription(
			hideYear
				? `Your birthday has been set to ${dateText}.\nYour birth year is not saved or shown.`
				: `Your birthday has been set to ${dateText}.\nYou will turn ${ageNow + 1} on your next birthday!`,
		)
		.setThumbnail(interaction.user.displayAvatarURL())
		.setFooter({ text: `Use /birthday clear to remove your birthday.` })
		.setColor("Aqua");
}

export default async function set(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const hideYear = interaction.options.getBoolean("hide_year") ?? false;
	const today = TodayInSweden();

	const birthday = ParseBirthday(interaction.options.getString("date", true), today.year);
	if ("error" in birthday) {
		await interaction.editReply({ content: birthday.error });
		return;
	}

	const age = AgeToday(birthday, today);

	const teacherRoleId = await GetServerConfig(interaction.guild.id, "teacherRoleId");
	const isTeacher = !!teacherRoleId && (interaction.member as GuildMember).roles.cache.has(teacherRoleId);
	if ((age > MAX_STUDENT_AGE || age < MIN_STUDENT_AGE) && !isTeacher) {
		await interaction.editReply({ content: `Invalid year. If you believe this is a mistake please make a support-ticket.` });
		return;
	}

	// saved as midnight UTC, so the day is the same whatever timezone the server or the person is in
	const savedTimestamp = Math.floor(Date.UTC(hideYear ? HIDDEN_YEAR : birthday.year, birthday.month - 1, birthday.day) / 1000);
	const saved = await UpdateProfile(interaction.user.id, interaction.guild.id, { birthday: savedTimestamp });
	if (saved === PROFILE_FAILED) {
		await interaction.editReply({ content: "I couldn't save your birthday, try again later." });
		return;
	}

	await interaction.editReply({ embeds: [BuildConfirmation(interaction, savedTimestamp, hideYear, age)] });

	// it is their birthday today, so they get their message now and not just at midnight
	// only theirs, everyone else already got theirs
	if (CompareDates(birthday, today) === 0) {
		const profile = await GetProfile(interaction.user.id, interaction.guild.id);
		if (profile) await AnnounceBirthdays(interaction.client, interaction.guild, [profile]);
	}
}
