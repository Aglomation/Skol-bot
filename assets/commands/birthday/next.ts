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
		}) || formattedList.find((entry) => !!entry.birthday);

	const nextBirthdayGroup = nextBirthday?.birthday
		? formattedList.filter(({ birthday }) =>
			!!birthday &&
			birthday.month === nextBirthday.birthday.month &&
			birthday.day === nextBirthday.birthday.day,
		)
		: [];
	if (!nextBirthday?.birthday) {
		await interaction.editReply({ content: "No birthdays have been set yet!" });
		return;
	}
	const displayNames = nextBirthdayGroup
		.map((entry) => getDisplayName(interaction.guild, entry.user.id) ?? `<@${entry.user.id}>`)
		.filter((name): name is string => Boolean(name));
	const birthdayYear =
		nextBirthday.birthday.month < currentMonth ||
		(nextBirthday.birthday.month === currentMonth && nextBirthday.birthday.day < currentDay)
			? currentYear + 1
			: currentYear;
	const nextBirthdayTimestamp = Math.floor(
		new Date(
			birthdayYear,
			(nextBirthday.birthday?.month || 1) - 1,
			nextBirthday.birthday?.day || 1,
		).getTime() / 1000,
	);
	const embed = new EmbedBuilder()
		.setTitle(
			`Next Birthday${nextBirthdayGroup.length > 1 ? "s" : ""}: ${numToMonth(nextBirthday.birthday?.month || 0)} ${nextBirthday.birthday?.day}`,
		)
		.setThumbnail(
			interaction.guild?.members.cache
				.get(nextBirthday?.user.id)
				?.displayAvatarURL() || null,
		)
		.setColor("Aqua")
		.setFooter({ text: `Use /birthday set to set your birthday!` })
		.setDescription(
			`The next birthday${nextBirthdayGroup.length > 1 ? "s" : ""} is ${nextBirthdayGroup.length > 1 ? `shared by: \n**${displayNames.join(", ")}**\n` : `**${getDisplayName(interaction.guild, nextBirthday?.user.id)}**`} and will be on <t:${nextBirthdayTimestamp}:D> <t:${nextBirthdayTimestamp}:R>`,
		);

	await interaction.editReply({
		embeds: [embed],
		allowedMentions: { users: [] },
	});
}
