import type { Guild } from "discord.js";
import { FindAllNonNullKeys } from "./profileManager.js";

export type BirthdayDate = { day: number; month: number; year: number };
export type SortedBirthday = { user: UserProfile; birthday: BirthdayDate | null };

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
			if (!birthday) return { user, birthday: null };

			const birthdayDate = new Date(birthday * 1000);
			return {
				user,
				birthday: {
					day: birthdayDate.getDate(),
					month: birthdayDate.getMonth() + 1,
					year: birthdayDate.getFullYear(),
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
export function GetNextBirthdays(list: SortedBirthday[], today = new Date()): NextBirthdays | null {
	const currentMonth = today.getMonth() + 1;
	const currentDay = today.getDate();

	const upcoming = list.find(({ birthday }) =>
		!!birthday &&
		(birthday.month > currentMonth || (birthday.month === currentMonth && birthday.day > currentDay)),
	);
	const next = upcoming ?? list.find(({ birthday }) => !!birthday);
	if (!next?.birthday) return null;

	const { month, day } = next.birthday;
	const group = list.filter(({ birthday }) => birthday?.month === month && birthday.day === day);

	const hasPassed = month < currentMonth || (month === currentMonth && day < currentDay);
	const year = hasPassed ? today.getFullYear() + 1 : today.getFullYear();
	const timestamp = Math.floor(new Date(year, month - 1, day).getTime() / 1000);

	return { group, month, day, timestamp };
}
