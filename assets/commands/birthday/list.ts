import type { ChatInputCommandInteraction, Guild, SlashCommandSubcommandBuilder } from "discord.js";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	MessageFlags,
} from "discord.js";
import { GetNextBirthdays, sortedList } from "../../../utils/birthdayUtils.js";
import { getDisplayName } from "../../../utils/memberUtils.js";
import { numToMonth } from "../../../utils/stringConvert.js";


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

export const generateBirthdayPage = async (
	page: number,
	guild: Guild | null,
): Promise<{
	embeds: EmbedBuilder[];
	components: ActionRowBuilder<ButtonBuilder>[];
} | null> => {
	if (!guild) return null;
	const formattedList = await sortedList(guild);
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

	const next = GetNextBirthdays(formattedList, today);

	const descLines: string[] = [];
	let hasInsertedYearSeparator = false;
	for (let i = 0; i < pageItems.length; i++) {
        const currentItem = pageItems[i];
        if (!currentItem.birthday) continue;

        const { user, birthday } = currentItem;

        const age = calculateAge(birthday, currentMonth, currentDay, currentYear);
        const name = getDisplayName(guild, user.discordId);
		if (!name) continue;
		
        const prevItem = pageItems[i - 1];

        const isFirstOfMonth = !prevItem || prevItem.birthday?.month !== birthday.month;
        
        const isNextUp =
			!!next &&
			next.month === birthday.month &&
			next.day === birthday.day;

        if (isFirstOfMonth) {
            descLines.push(`### __**${numToMonth(birthday.month)}**__\n`);
        }

		const isToday = birthday.month === currentMonth && birthday.day === currentDay;
        const daySuffix = getSuffix(birthday.day);

		if ((isToday || isNextUp) && !hasInsertedYearSeparator) {
            descLines.push(`-# ▫️ ${currentDay}${getSuffix(currentDay)} Today's date \n`);
            hasInsertedYearSeparator = true;
        }

        if (isToday) {
            descLines.push(`▫️ **${birthday.day}${daySuffix}** - **${name}** (Turns ${age} today! 🎂)\n`);
        } else {
            descLines.push(`▫️ **${birthday.day}${daySuffix}** - ${name} \`${age}\`\n`);
        }
	}

	let nextBirthdayValue = "No upcoming birthdays";
	if (next) {
		const displayNames = next.group
			.map((entry) => getDisplayName(guild, entry.user.discordId))
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
			text: `Total (${formattedList.length}) ・ ${pageSize} per page [Showing: ${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, formattedList.length)}] ・ Use /birthday set to set your birthday!`,
		})
		.setDescription(descLines.join(""))
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

export default async function list(
	interaction: ChatInputCommandInteraction,
	page = 1,
) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral});
	const pageData = await generateBirthdayPage(page, interaction.guild);

	if (!pageData) {
		// Handle empty list gracefully
		return interaction.editReply({
			content: "No birthdays have been set yet!",
		});
	}

	await interaction.editReply(pageData);
}
