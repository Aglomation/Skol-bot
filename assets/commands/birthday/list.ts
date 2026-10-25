import type { ChatInputCommandInteraction, Guild, SlashCommandSubcommandBuilder } from "discord.js";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	MessageFlags,
} from "discord.js";
import { GetNextBirthdays, GetSortedBirthdays, HasBirthYear, TodayInSweden } from "../../../utils/birthdayUtils.js";
import { GetDisplayName } from "../../../utils/memberUtils.js";
import { NumToMonth } from "../../../utils/stringConvert.js";


const PAGE_SIZE = 25;

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
		.setName("list")
		.setDescription("Shows all birthdays")
		.setDescriptionLocalizations({
			"sv-SE": "Visar alla födelsedagar",
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

const getSuffix = (day: number) => {
	if (day >= 11 && day <= 13) return "th";
	switch (day % 10) {
		case 1: return "st";
		case 2: return "nd";
		case 3: return "rd";
		default: return "th";
	}
};

const compareDates = (m1: number, d1: number, m2: number, d2: number) => {
    if (m1 !== m2) return m1 - m2;
    return d1 - d2;
};

export const GenerateBirthdayPage = async (
	page: number,
	guild: Guild | null,
): Promise<{
	embeds: EmbedBuilder[];
	components: ActionRowBuilder<ButtonBuilder>[];
} | null> => {
	if (!guild) return null;
	const formattedList = await GetSortedBirthdays(guild);
	if (!formattedList || formattedList.length === 0) return null;

	const maxPage = Math.ceil(formattedList.length / PAGE_SIZE) || 1;

	const currentPage = Math.max(1, Math.min(page, maxPage));

	const pageItems = formattedList.slice(
		(currentPage - 1) * PAGE_SIZE,
		currentPage * PAGE_SIZE,
	);
	const today = TodayInSweden();
	const currentMonth = today.month;
	const currentDay = today.day;
	const currentYear = today.year;

	const next = GetNextBirthdays(formattedList, today);

	const descLines: string[] = [];
    let hasInsertedToday = false;
    let lastMonth: number | null = null;

    for (let i = 0; i < pageItems.length; i++) {
        const currentItem = pageItems[i];
        if (!currentItem.birthday) continue;

        const { user, birthday } = currentItem;
        const prevItem = i > 0 ? pageItems[i - 1] : null;

        if (!hasInsertedToday && prevItem && prevItem.birthday) {
            const isTodayBetween = 
                compareDates(prevItem.birthday.month, prevItem.birthday.day, currentMonth, currentDay) <= 0 &&
                compareDates(currentMonth, currentDay, birthday.month, birthday.day) < 0;

            if (isTodayBetween && prevItem.birthday.month === currentMonth) {
                descLines.push(`-# ▫️ ${currentDay}${getSuffix(currentDay)} Today's date \n`);
                hasInsertedToday = true;
            }
        }

        if (lastMonth !== birthday.month) {
            if (!hasInsertedToday && currentMonth === birthday.month && compareDates(currentMonth, currentDay, birthday.month, birthday.day) < 0) {
				descLines.push(`### __**${NumToMonth(birthday.month)}**__\n`);
                descLines.push(`-# ▫️ ${currentDay}${getSuffix(currentDay)} Today's date \n`);
                hasInsertedToday = true;
                lastMonth = birthday.month;
            } else {
				descLines.push(`### __**${NumToMonth(birthday.month)}**__\n`);
                lastMonth = birthday.month;
            }
        }

        const isToday = birthday.month === currentMonth && birthday.day === currentDay;
        if (isToday && !hasInsertedToday) {
            descLines.push(`-# ▫️ ${currentDay}${getSuffix(currentDay)} Today's date \n`);
            hasInsertedToday = true;
        }

		const hasYear = HasBirthYear(birthday);
        const age = calculateAge(birthday, currentMonth, currentDay, currentYear);
		const name = GetDisplayName(guild, user.discordId);
        const daySuffix = getSuffix(birthday.day);

        if (isToday) {
			descLines.push(`▫️ **${birthday.day}${daySuffix}** - **${name}** ${hasYear ? `(Turns ${age} today! 🎂)` : "🎂"}\n`);
        } else {
            const isNextUp = !!next && next.month === birthday.month && next.day === birthday.day;
			descLines.push(`▫️ **${birthday.day}${daySuffix}** - ${name}${hasYear ? ` \`${age}\`` : ""}${isNextUp ? " - Next Up!" : ""}\n`);
        }
    }

	let nextBirthdayValue = "No upcoming birthdays";
	if (next) {
		const displayNames = next.group
			.map((entry) => GetDisplayName(guild, entry.user.discordId))
			.filter((name): name is string => Boolean(name));

		nextBirthdayValue = displayNames.map(name => `• ${name}`).join(`\n`);
	}

	const embed = new EmbedBuilder()
		.setTitle(
			`Birthdays | Page ${currentPage}/${maxPage} [${formattedList.length}]`,
		)
		.setAuthor({ name: guild?.name || "", iconURL: guild?.iconURL?.() || undefined })
		.setColor("Aqua")
		.setFooter({
			text: `Total (${formattedList.length}) ・ ${PAGE_SIZE} per page [Showing: ${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(currentPage * PAGE_SIZE, formattedList.length)}] ・ Use /birthday set to set your birthday!`,
		})
		.setDescription(descLines.join("").trim())
		.setFields([
			{
				name: next ? `Next Upcoming Birthday (<t:${next.timestamp}:R>)` : "Next Upcoming Birthday",
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

	const nextPage = new ButtonBuilder()
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
		nextPage,
		last,
	);

	return {
		embeds: [embed],
		components: [row],
	};
};

export default async function command(
interaction: ChatInputCommandInteraction,
) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guild) {
        return interaction.editReply({ content: "This command can only be used in a server." });
    }

	const formattedList = await GetSortedBirthdays(interaction.guild);
    if (!formattedList || formattedList.length === 0) {
        return interaction.editReply({ content: "No birthdays have been set yet!" });
    }

    const today = TodayInSweden();
    const next = GetNextBirthdays(formattedList, today);

    let targetPageIndex = 0;

    if (next) {
        // Find the index of the next upcoming birthday in the sorted list
        const index = formattedList.findIndex(
            (item) => item.birthday?.month === next.month && item.birthday?.day === next.day
        );
        if (index !== -1) {
            targetPageIndex = Math.floor(index / PAGE_SIZE);
        }
    }

    const targetPage = targetPageIndex + 1; // Pages are 1-indexed
	const pageData = await GenerateBirthdayPage(targetPage, interaction.guild);

    if (!pageData) {
        return interaction.editReply({
            content: "No birthdays have been set yet!",
        });
    }

    await interaction.editReply(pageData);
}
