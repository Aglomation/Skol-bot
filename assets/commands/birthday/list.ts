import type { ChatInputCommandInteraction, Client } from "discord.js";
import {
	type Guild,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} from "discord.js";
import { sortedList } from "./main.js";
import { numToMonth } from "../../../utils/stringConvert.js";

export const generateBirthdayPage = async (
	page: number,
	guild: Guild | null,
): Promise<{
	embeds: EmbedBuilder[];
	components: ActionRowBuilder<ButtonBuilder>[];
} | null> => {
	const formattedList = await sortedList();

	if (!formattedList || formattedList.length === 0) return null;

	const pageSize = 30;
	const maxPage = Math.ceil(formattedList.length / pageSize) || 1;

	const currentPage = Math.max(1, Math.min(page, maxPage));

	const pageItems = formattedList.slice(
		(currentPage - 1) * pageSize,
		currentPage * pageSize,
	);

	const today = new Date();
	const currentMonth = today.getMonth() + 1;
	const currentDay = today.getDate();
	const currentYear = today.getFullYear();

	const nextBirthday =
		formattedList.find(({ birthday }) => {
			if (!birthday) return false;
			return (
				birthday.month > currentMonth ||
				(birthday.month === currentMonth && birthday.day > currentDay)
			);
		}) || formattedList.find((entry) => !!entry.birthday);

	const descLines: string[] = [];

	let hasInsertedYearSeparator = false;

	for (let i = 0; i < pageItems.length; i++) {
		const { user, birthday } = pageItems[i];
		if (!birthday) continue;

		const age =
			currentMonth > birthday.month ||
			(currentMonth === birthday.month && currentDay >= birthday.day)
				? currentYear - birthday.year
				: currentYear - birthday.year - 1;

		const member = guild?.members.cache.get(user.id);
		const name =
			(member?.nickname || member?.displayName || member?.user.username)?.slice(
				0,
				26,
			) || "Unknown User";

		const prev = pageItems[i - 1];
		const next = pageItems[i + 1];

		const firstofmonth = !prev || prev.birthday?.month !== birthday.month;
		const lastofmonth = !next || next.birthday?.month !== birthday.month;

		const isNextUp =
			!!nextBirthday?.birthday &&
			nextBirthday.birthday.month === birthday.month &&
			nextBirthday.birthday.day === birthday.day;

		if (isNextUp && !hasInsertedYearSeparator) {
			descLines.push(`-# | ​ (${currentDay}) Today's date \n`);
			hasInsertedYearSeparator = true;
		}

		if (firstofmonth) {
			descLines.push(`### __**${numToMonth(birthday.month)}**__\n`);
		}

		descLines.push(
			`${!lastofmonth ? "| ​" : "↳"} (${birthday.day}) ${name} [${age}]\n`,
		);
	}

	let nextBirthdayValue = "No upcoming birthdays";
	if (nextBirthday?.birthday) {
		const nextBirthdayMember = guild?.members.cache.get(nextBirthday.user.id);
		const displayName =
			nextBirthdayMember?.displayName ||
			nextBirthdayMember?.user.username ||
			"Unknown User";

		const displayYear =
			nextBirthday.birthday.month < currentMonth
				? currentYear + 1
				: currentYear;
		const nextBdayTime = Math.floor(
			new Date(
				displayYear,
				nextBirthday?.birthday.month - 1,
				nextBirthday.birthday.day,
			).getTime() / 1000,
		);

		nextBirthdayValue = `${displayName} - <t:${nextBdayTime}:R>`;
	}

	const embed = new EmbedBuilder()
		.setTitle(
			`Birthdays | Page ${currentPage}/${maxPage} [${formattedList.length}]`,
		)
		.setAuthor({ name: guild?.name || "", iconURL: guild?.iconURL?.() || "" })
		.setColor("Aqua")
		.setFooter({
			text: `Total (${formattedList.length}) ・ ${pageSize} per page [Showing: ${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, formattedList.length)}] ・ Use /birthday set to set your birthday!`,
		})
		.setDescription(descLines.join(""))
		.setFields([
			{
				name: "Next Birthday",
				value: nextBirthdayValue,
			},
		]);

	const first = new ButtonBuilder()
		.setEmoji("⏮️")
		.setStyle(ButtonStyle.Secondary)
		.setCustomId(`birthdaychangepage:0first`)
		.setDisabled(currentPage <= 1);

	const prev = new ButtonBuilder()
		.setEmoji("◀️")
		.setStyle(ButtonStyle.Primary)
		.setCustomId(`birthdaychangepage:${currentPage - 1}`)
		.setDisabled(currentPage <= 1);

	const next = new ButtonBuilder()
		.setEmoji("▶️")
		.setStyle(ButtonStyle.Primary)
		.setCustomId(`birthdaychangepage:${currentPage + 1}`)
		.setDisabled(currentPage >= maxPage);

	const last = new ButtonBuilder()
		.setEmoji("⏭️")
		.setStyle(ButtonStyle.Secondary)
		.setCustomId(`birthdaychangepage:${maxPage}last`)
		.setDisabled(currentPage >= maxPage);

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		first,
		prev,
		next,
		last,
	);

	return {
		embeds: [embed],
		components: [row],
	};
};

export default async function list(
	interaction: ChatInputCommandInteraction,
	_client: Client,
	page: number = 1,
) {
	await interaction.deferReply();
	const pageData = await generateBirthdayPage(page, interaction.guild);

	if (!pageData) {
		// Handle empty list gracefully
		return interaction.editReply({
			content: "No birthdays have been set yet!",
		});
	}

	await interaction.editReply(pageData);
}
