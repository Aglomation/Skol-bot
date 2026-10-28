import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { GetSwedenParts, SwedenToUtc } from "../../utils/swedenTime.js";

type CalendarDate = { year: number; month: number; day: number };
type Holiday = { name: string; date: CalendarDate };

const DAY_MS = 86400000;

const ToUtc = ({ year, month, day }: CalendarDate) => Date.UTC(year, month - 1, day);

function FromUtc(timestamp: number): CalendarDate {
	const date = new Date(timestamp);
	return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

const AddDays = (date: CalendarDate, days: number) => FromUtc(ToUtc(date) + days * DAY_MS);
const GetWeekday = (date: CalendarDate) => new Date(ToUtc(date)).getUTCDay();
const IsSame = (a: CalendarDate, b: CalendarDate) => a.year === b.year && a.month === b.month && a.day === b.day;

function ParseCalendarDate(input: string): CalendarDate | null {
	const match = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return null;

	const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
	return IsSame(FromUtc(ToUtc(date)), date) ? date : null;
}

function GetIsoWeek(date: CalendarDate): number {
	const thursday = AddDays(date, 4 - (GetWeekday(date) || 7));
	const yearStart = Date.UTC(thursday.year, 0, 1);
	return Math.ceil(((ToUtc(thursday) - yearStart) / DAY_MS + 1) / 7);
}

function GetWeekRange(date: CalendarDate): { start: CalendarDate; end: CalendarDate } {
	const weekday = GetWeekday(date) || 7;
	return { start: AddDays(date, 1 - weekday), end: AddDays(date, 7 - weekday) };
}

function GetEaster(year: number): CalendarDate {
	const a = year % 19;
	const b = Math.floor(year / 100);
	const c = year % 100;
	const d = Math.floor(b / 4);
	const e = b % 4;
	const f = Math.floor((b + 8) / 25);
	const g = Math.floor((b - f + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30;
	const i = Math.floor(c / 4);
	const k = c % 4;
	const l = (32 + 2 * e + 2 * i - h - k) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const month = Math.floor((h + l - 7 * m + 114) / 31);
	const day = ((h + l - 7 * m + 114) % 31) + 1;
	return { year, month, day };
}

function FindWeekday(year: number, month: number, from: number, weekday: number): CalendarDate {
	for (let day = from; day < from + 7; day++) {
		const date = FromUtc(Date.UTC(year, month - 1, day));
		if (GetWeekday(date) === weekday) return date;
	}
	return { year, month, day: from };
}

function GetHolidays(year: number): Holiday[] {
	const easter = GetEaster(year);
	const fixed = (month: number, day: number): CalendarDate => ({ year, month, day });

	return [
		{ name: "Nyårsdagen", date: fixed(1, 1) },
		{ name: "Trettondedag jul", date: fixed(1, 6) },
		{ name: "Långfredagen", date: AddDays(easter, -2) },
		{ name: "Påskdagen", date: easter },
		{ name: "Annandag påsk", date: AddDays(easter, 1) },
		{ name: "Första maj", date: fixed(5, 1) },
		{ name: "Kristi himmelsfärdsdag", date: AddDays(easter, 39) },
		{ name: "Pingstdagen", date: AddDays(easter, 49) },
		{ name: "Sveriges nationaldag", date: fixed(6, 6) },
		{ name: "Midsommarafton", date: FindWeekday(year, 6, 19, 5) },
		{ name: "Midsommardagen", date: FindWeekday(year, 6, 20, 6) },
		{ name: "Alla helgons dag", date: FindWeekday(year, 10, 31, 6) },
		{ name: "Julafton", date: fixed(12, 24) },
		{ name: "Juldagen", date: fixed(12, 25) },
		{ name: "Annandag jul", date: fixed(12, 26) },
		{ name: "Nyårsafton", date: fixed(12, 31) },
	].sort((a, b) => ToUtc(a.date) - ToUtc(b.date));
}

function GetHolidayOn(date: CalendarDate): string | null {
	return GetHolidays(date.year).find((holiday) => IsSame(holiday.date, date))?.name ?? null;
}

function GetNextDayOff(after: CalendarDate): Holiday | null {
	for (let year = after.year; year <= after.year + 1; year++) {
		const next = GetHolidays(year).find((holiday) => {
			const weekday = GetWeekday(holiday.date);
			return ToUtc(holiday.date) > ToUtc(after) && weekday >= 1 && weekday <= 5;
		});
		if (next) return next;
	}
	return null;
}

const Stamp = (date: CalendarDate, hour: number) => Math.floor((SwedenToUtc(date.year, date.month, date.day, hour, 0) ?? 0) / 1000);
const Day = (date: CalendarDate) => `<t:${Stamp(date, 12)}:D>`;

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("week")
		.setDescription("Shows the week number and the next day off")
		.addStringOption((option) =>
			option.setName("date").setDescription("A date to look up (YYYY-MM-DD), default is today"),
		),

	async execute(interaction: ChatInputCommandInteraction) {
		const input = interaction.options.getString("date");
		const parsed = input ? ParseCalendarDate(input) : null;

		if (input && !parsed) {
			await interaction.reply({ content: "Use the format YYYY-MM-DD, like 2026-12-24.", flags: MessageFlags.Ephemeral });
			return;
		}

		const today = GetSwedenParts(Date.now());
		const date = parsed ?? { year: today.year, month: today.month, day: today.day };

		const range = GetWeekRange(date);
		const holiday = GetHolidayOn(date);
		const next = GetNextDayOff(date);

		const lines = [`Week **${GetIsoWeek(date)}**: ${Day(range.start)} to ${Day(range.end)}`];
		if (holiday) lines.push(`${parsed ? "That day is" : "Today is"} **${holiday}**.`);
		if (next) lines.push(`Next day off: **${next.name}**, ${Day(next.date)} (<t:${Stamp(next.date, 0)}:R>)`);
		lines.push("-# Only public holidays, school breaks are different in every municipality.");

		await interaction.reply({ content: lines.join("\n") });
	},
};

export default command;
