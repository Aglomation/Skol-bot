import type { Client, Guild, TextChannel } from "discord.js";
import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { GetServerConfig } from "../utils/configManager.js";
import { GetDisplayName } from "../utils/memberUtils.js";
import { FindAllNonNullKeys } from "../utils/profileManager.js";
import { GetSwedenParts } from "../utils/swedenTime.js";

export type BirthdayDate = { day: number; month: number; year: number };
export type SortedBirthday = { user: UserProfile; birthday: BirthdayDate | null };

/**
 * Today in Sweden, it is the same date whatever timezone the server is in
 */
export function TodayInSweden(now = new Date()): BirthdayDate {
	const { year, month, day } = GetSwedenParts(now.getTime());

	return { year, month, day };
}

export function IsLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// a birthday saved without a year gets this year instead, it is a leap year so the 29th of February still works
export const HIDDEN_YEAR = 1604;

/** Negative if a comes first in the year, positive if b does */
export function CompareDates(a: { month: number; day: number }, b: { month: number; day: number }): number {
	return a.month !== b.month ? a.month - b.month : a.day - b.day;
}

/** The age someone has (or turns) this year, counting from the day of the birthday itself */
export function AgeToday(birthday: BirthdayDate, today: BirthdayDate): number {
	const hasHadBirthday = CompareDates(birthday, today) <= 0;

	return today.year - birthday.year - (hasHadBirthday ? 0 : 1);
}

export const HasBirthYear = (birthday: { year: number }) => birthday.year !== HIDDEN_YEAR;

/**
 * A saved birthday as text, like 17 May 1990
 * Birthdays are saved as midnight UTC, discords <t:> times would show the day before for people west of that
 * @param timestamp Seconds
 */
export function FormatBirthday(timestamp: number): string {
	const date = new Date(timestamp * 1000);

	return date.toLocaleDateString("en-GB", {
		timeZone: "UTC",
		day: "numeric",
		month: "long",
		year: date.getUTCFullYear() === HIDDEN_YEAR ? undefined : "numeric",
	});
}

export function IsBirthdayOn(birthday: { month: number; day: number }, today: BirthdayDate): boolean {
	if (birthday.month === today.month && birthday.day === today.day) return true;

	return birthday.month === 2 && birthday.day === 29 && today.month === 3 && today.day === 1 && !IsLeapYear(today.year);
}

/**
 * Everyone in the server with a birthday, sorted by month and day (the year doesnt matter for the order)
 * @returns null if nobody has set one
 */
export const GetSortedBirthdays = async (guild: Guild): Promise<SortedBirthday[] | null> => {
	const users = await FindAllNonNullKeys("birthday", guild.id);

	if (users.length === 0) return null;

	return users
		.map((user): SortedBirthday => {
			if (user.birthday == null) return { user, birthday: null };

			// Parse the timestamp into parts using Sweden's timezone
			const { year, month, day } = GetSwedenParts(user.birthday * 1000);

			return { user, birthday: { year, month, day } };
		})
		.sort((a, b) => {
			if (!a.birthday || !b.birthday) return 0;
			if (a.birthday.month !== b.birthday.month) {
				return a.birthday.month - b.birthday.month;
			}
			return a.birthday.day - b.birthday.day;
		});
};

export type NextBirthdays = {
	group: SortedBirthday[]; // everyone that has it that day
	month: number;
	day: number;
	timestamp: number; // seconds, for discords <t:> times
};

/**
 * Finds the next birthday after today, and everyone who shares that day
 * If none are left this year it is the first one next year
 * @param list The list from GetSortedBirthdays
 */
export function GetNextBirthdays(list: SortedBirthday[], today: BirthdayDate = TodayInSweden()): NextBirthdays | null {
	const currentMonth = today.month;
	const currentDay = today.day;

	const upcoming = list.find(({ birthday }) =>
		!!birthday &&
		(birthday.month > currentMonth || (birthday.month === currentMonth && birthday.day > currentDay)),
	);
	const next = upcoming ?? list.find(({ birthday }) => !!birthday);
	if (!next?.birthday) return null;

	const { month, day } = next.birthday;
	const group = list.filter(({ birthday }) => birthday?.month === month && birthday.day === day);

	// today counts as passed, if the only birthday is today the next one is next year
	const hasPassed = month < currentMonth || (month === currentMonth && day <= currentDay);
	const year = hasPassed ? today.year + 1 : today.year;
	const timestamp = Math.floor(Date.UTC(year, month - 1, day) / 1000);

	return { group, month, day, timestamp };
}

const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

/**
 * Converts a month number (1-12) to its corresponding month name. Overflow rolls over (13 -> January)
 * @param input The input month number (1-12)
 * @returns The corresponding month name or "Unknown" if invalid
 */
export function NumToMonth(input: number): string {
	return MONTHS[(((input - 1) % 12) + 12) % 12] ?? "Unknown";
}

const formatBirthdayLine = (guild: Guild | null, member: UserProfile, currentYear: number): string => {
	const name = GetDisplayName(guild, member.discordId);
	const mention = `(<@${member.discordId}>)`;

	// birthdays are saved as midnight UTC
	const birthdayDate = new Date((member.birthday as number) * 1000);
	if (birthdayDate.getUTCFullYear() === HIDDEN_YEAR) return `${name} ${mention}`;

	return `${name} ${mention} - ${currentYear - birthdayDate.getUTCFullYear()} Years old`;
};

// "server:user:month-day" of everyone that already got their message today, so setting a birthday on the day itself can't post it twice
const announced = new Set<string>();

/**
 * Sends the happy birthday message for these members in the birthday channel of the server
 * Anyone who already got one today is skipped
 */
export async function AnnounceBirthdays(client: Client, guild: Guild, members: UserProfile[]): Promise<void> {
	const today = TodayInSweden();
	const day = `${today.month}-${today.day}`;

	// forget the ones from earlier days
	for (const key of announced) {
		if (!key.endsWith(`:${day}`)) announced.delete(key);
	}

	const channelId = await GetServerConfig(guild.id, "birthdayChannel");
	const birthdayChannel = channelId ? client.channels.cache.get(channelId) as TextChannel | undefined : undefined;
	if (!client.user || !birthdayChannel?.permissionsFor(client.user)?.has(PermissionFlagsBits.SendMessages)) return;

	const todaysBirthdays = members.filter((member) => !announced.has(`${guild.id}:${member.discordId}:${day}`));
	if (todaysBirthdays.length === 0) return;

	todaysBirthdays.sort((a, b) => {
		const yearA = new Date((a.birthday as number) * 1000)?.getUTCFullYear() || 0;
		const yearB = new Date((b.birthday as number) * 1000)?.getUTCFullYear() || 0;
		return yearB - yearA;
	});

	const descriptionLines = todaysBirthdays.map(member =>
		formatBirthdayLine(guild, member, today.year)
	);

	const embed = new EmbedBuilder()
		.setTitle("🎉 Happy Birthday! 🎉")
		.setDescription(descriptionLines.join("\n"))
		.setFooter({ text: "Use /birthday set to set your birthday!" })
		.setColor(0xff0000);

	const response = await birthdayChannel.send({
		embeds: [embed],
		allowedMentions: { users: [] },
	});

	for (const member of todaysBirthdays) announced.add(`${guild.id}:${member.discordId}:${day}`);

	response.react("🎉").catch(() => null);
}
