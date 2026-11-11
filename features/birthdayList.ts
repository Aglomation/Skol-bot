import type { Guild } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { GetDisplayName } from "../utils/memberUtils.js";
import type { BirthdayDate, NextBirthdays, SortedBirthday } from "./birthdays.js";
import { AgeToday, CompareDates, GetNextBirthdays, GetSortedBirthdays, HasBirthYear, NumToMonth, TodayInSweden } from "./birthdays.js";

// The paged list of birthdays that /birthday list shows, the buttons under it (buttons/birthdaychangepage.ts) ask for the other pages
const PAGE_SIZE = 25;
const PAGE_BUTTON_ID = "birthdaychangepage";

/** 1 -> "st", 2 -> "nd", 3 -> "rd", 11 -> "th" */
function OrdinalSuffix(day: number): string {
	if (day >= 11 && day <= 13) return "th";

	return ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[day % 10] ?? "th";
}

/** The list of one page, grouped under the month names, with a marker where today's date would be */
function BuildBirthdayLines(items: SortedBirthday[], guild: Guild, today: BirthdayDate, next: NextBirthdays | null): string {
	const todayMarker = `-# ▫️ ${today.day}${OrdinalSuffix(today.day)} Today's date \n`;
	const lines: string[] = [];
	let markerPlaced = false;
	let lastMonth: number | null = null;

	items.forEach((item, index) => {
		if (!item.birthday) return;
		const { user, birthday } = item;
		const previous = items[index - 1]?.birthday;

		// today falls between the birthday before and this one
		if (!markerPlaced && previous && CompareDates(previous, today) <= 0 && CompareDates(today, birthday) < 0 && previous.month === today.month) {
			lines.push(todayMarker);
			markerPlaced = true;
		}

		if (lastMonth !== birthday.month) {
			lines.push(`### __**${NumToMonth(birthday.month)}**__\n`);
			lastMonth = birthday.month;

			// today comes before the first birthday of this month
			if (!markerPlaced && birthday.month === today.month && CompareDates(today, birthday) < 0) {
				lines.push(todayMarker);
				markerPlaced = true;
			}
		}

		const isToday = CompareDates(birthday, today) === 0;
		if (isToday && !markerPlaced) {
			lines.push(todayMarker);
			markerPlaced = true;
		}

		const name = GetDisplayName(guild, user.discordId);
		const dayText = `**${birthday.day}${OrdinalSuffix(birthday.day)}**`;
		const hasYear = HasBirthYear(birthday);
		const age = AgeToday(birthday, today);

		if (isToday) {
			lines.push(`▫️ ${dayText} - **${name}** ${hasYear ? `(Turns ${age} today! 🎂)` : "🎂"}\n`);
		} else {
			const isNextUp = !!next && CompareDates(next, birthday) === 0;
			lines.push(`▫️ ${dayText} - ${name}${hasYear ? ` \`${age}\`` : ""}${isNextUp ? " - Next Up!" : ""}\n`);
		}
	});

	return lines.join("").trim();
}

/** The "Next Upcoming Birthday" field: the date, and everyone who has it */
function BuildNextBirthdayField(next: NextBirthdays | null, guild: Guild): { name: string; value: string } {
	if (!next) return { name: "Next Upcoming Birthday", value: "No upcoming birthdays" };

	const names = next.group.map((entry) => GetDisplayName(guild, entry.user.discordId)).filter((name): name is string => Boolean(name));

	return {
		name: `Next Upcoming Birthday (<t:${next.timestamp}:R>)`,
		value: names.map((name) => `• ${name}`).join("\n"),
	};
}

/** First, previous, next and last page. The ids end up in buttons/birthdaychangepage.ts, which reads the number at the start */
function BuildPageButtons(currentPage: number, pageCount: number): ActionRowBuilder<ButtonBuilder> {
	const onFirstPage = currentPage <= 1;
	const onLastPage = currentPage >= pageCount;

	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setEmoji("⏮️").setStyle(ButtonStyle.Secondary).setCustomId(`${PAGE_BUTTON_ID}:0first`).setDisabled(onFirstPage),
		new ButtonBuilder().setEmoji("◀️").setStyle(ButtonStyle.Primary).setCustomId(`${PAGE_BUTTON_ID}:${currentPage - 1}`).setDisabled(onFirstPage),
		new ButtonBuilder().setEmoji("▶️").setStyle(ButtonStyle.Primary).setCustomId(`${PAGE_BUTTON_ID}:${currentPage + 1}`).setDisabled(onLastPage),
		new ButtonBuilder().setEmoji("⏭️").setStyle(ButtonStyle.Secondary).setCustomId(`${PAGE_BUTTON_ID}:${pageCount}last`).setDisabled(onLastPage),
	);
}

/** The page (starting at 1) that has the next birthday on it */
function PageOfNextBirthday(birthdays: SortedBirthday[], next: NextBirthdays | null): number {
	const index = next ? birthdays.findIndex((item) => item.birthday && CompareDates(item.birthday, next) === 0) : -1;

	return index === -1 ? 1 : Math.floor(index / PAGE_SIZE) + 1;
}

/**
 * The message with one page of the birthday list
 * @param page Starting at 1, a page that doesn't exist becomes the first or the last. Leave it out for the page with the next birthday
 * @returns null if nobody in the server has set a birthday
 */
export async function GenerateBirthdayPage(guild: Guild | null, page?: number) {
	if (!guild) return null;

	const birthdays = await GetSortedBirthdays(guild);
	if (!birthdays) return null;

	const today = TodayInSweden();
	const next = GetNextBirthdays(birthdays, today);

	const pageCount = Math.ceil(birthdays.length / PAGE_SIZE) || 1;
	const currentPage = Math.max(1, Math.min(page ?? PageOfNextBirthday(birthdays, next), pageCount));
	const firstShown = (currentPage - 1) * PAGE_SIZE + 1;
	const lastShown = Math.min(currentPage * PAGE_SIZE, birthdays.length);

	const embed = new EmbedBuilder()
		.setTitle(`Birthdays | Page ${currentPage}/${pageCount} [${birthdays.length}]`)
		.setAuthor({ name: guild.name, iconURL: guild.iconURL() ?? undefined })
		.setColor("Aqua")
		.setFooter({ text: `Total (${birthdays.length}) ・ ${PAGE_SIZE} per page [Showing: ${firstShown}-${lastShown}] ・ Use /birthday set to set your birthday!` })
		.setDescription(BuildBirthdayLines(birthdays.slice(firstShown - 1, lastShown), guild, today, next))
		.setFields([BuildNextBirthdayField(next, guild)]);

	return { embeds: [embed], components: [BuildPageButtons(currentPage, pageCount)] };
}
