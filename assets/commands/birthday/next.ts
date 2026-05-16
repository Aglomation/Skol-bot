import type { ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { getDisplayName } from "../../../utils/memberUtils.js";
import { numToMonth } from "../../../utils/stringConvert.js";
import { sortedList } from "./main.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
		.setName("next")
		.setDescription("Shows the next birthday")
		.setDescriptionLocalizations({
			"sv-SE": "Visar nästa födelsedag",
		});

const calculateAge = (
	birthday: { month: number; day: number; year: number },
	currentMonth: number,
	currentDay: number,
	currentYear: number
): number => {
	const hasHadBirthday =
		currentMonth > birthday.month ||
		(currentMonth === birthday.month && currentDay >= birthday.day);
	return hasHadBirthday ? currentYear - birthday.year : currentYear - birthday.year - 1;
};

export default async function next(
	interaction: ChatInputCommandInteraction,
	_client: Client,
) {
	await interaction.deferReply({});
	const formattedList = await sortedList();

	if (!formattedList || formattedList.length === 0) {
		await interaction.editReply({ content: "No birthdays have been set yet!" });
		return;
	}
	const today = new Date();
	const currentMonth = today.getMonth() + 1;
	const currentDay = today.getDate();
	const currentYear = today.getFullYear();

	// Finds the next upcoming birthday, if none are upcoming get the first one next year
	const nextBirthday = 
	formattedList.find(({ birthday }) => {
		if (!birthday) return false;
		return (
			birthday.month > currentMonth ||
			(birthday.month === currentMonth && birthday.day > currentDay)
		);
	}) || formattedList.find((entry) => !!entry.birthday) || null;

	if (!nextBirthday) {
		await interaction.editReply({
			content: "No upcoming birthdays found until next year!",
		});
		return;
	}

	const nextBirthdayAge = calculateAge(nextBirthday.birthday, currentMonth, currentDay, currentYear);
	const nextBirthdayTimestamp = Math.floor(
		new Date(
			currentYear,
			(nextBirthday.birthday?.month || 1) - 1,
			nextBirthday.birthday?.day || 1,
		).getTime() / 1000,
	);
	const embed = new EmbedBuilder()
		.setTitle(
			`Next Birthday: ${numToMonth(nextBirthday.birthday?.month || 0)} ${nextBirthday.birthday?.day}`,
		)
		.setThumbnail(
			interaction.guild?.members.cache
				.get(nextBirthday?.user.id)
				?.displayAvatarURL() || null,
		)
		.setColor("Aqua")
		.setFooter({ text: `Use /birthday set to set your birthday!` })
		.setDescription(
			`The next birthday is ${getDisplayName(interaction.guild, nextBirthday?.user.id)} who turns ${nextBirthdayAge} years old <t:${nextBirthdayTimestamp}:R>`,
		);

	await interaction.editReply({
		embeds: [embed],
		allowedMentions: { users: [] },
	});
}
