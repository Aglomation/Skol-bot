import type { Guild } from "discord.js";
import { FindAllNonNullKeys } from "./profileManager.js";

export type BirthdayDate = { day: number; month: number; year: number };
export type SortedBirthday = { user: UserProfile; birthday: BirthdayDate | null };

/**
 * Today in Sweden, it is the same date whatever timezone the server is in
 */
export function TodayInSweden(now = new Date()): BirthdayDate {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Europe/Stockholm",
		year: "numeric",
		month: "numeric",
		day: "numeric",
	}).formatToParts(now);
	const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);

	return { year: get("year"), month: get("month"), day: get("day") };
}

export function IsLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * A saved birthday as text, like 17 May 1990
 * Birthdays are saved as midnight UTC, discords <t:> times would show the day before for people west of that
 * @param timestamp Seconds
 */
export function FormatBirthday(timestamp: number): string {
	return new Date(timestamp * 1000).toLocaleDateString("en-GB", {
		timeZone: "UTC",
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

/**
 * Everyone in the server with a birthday, sorted by month and day (the year doesnt matter for the order)
 * @returns null if nobody has set one
 */
export const sortedList = async (guild: Guild): Promise<SortedBirthday[] | null> => {
    const users = await FindAllNonNullKeys("birthday", guild.id);

    if (users.length === 0) return null;

    return users
        .map((user): SortedBirthday => {
            const birthday = user.birthday as UserProfile["birthday"] | null;
            if (birthday == null) return { user, birthday: null };

            // Parse the timestamp into parts using Sweden's timezone
            const parts = new Intl.DateTimeFormat("en-CA", {
                timeZone: "Europe/Stockholm",
                year: "numeric",
                month: "numeric",
                day: "numeric",
            }).formatToParts(new Date(birthday * 1000));

            const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);

            return {
                user,
                birthday: {
                    year: get("year"),
                    month: get("month"),
                    day: get("day"),
                },
            };
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
 * @param list The list from sortedList
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
