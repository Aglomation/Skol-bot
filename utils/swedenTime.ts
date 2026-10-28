export type SwedenParts = {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	weekday: number;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const FORMAT = new Intl.DateTimeFormat("en-US", {
	timeZone: "Europe/Stockholm",
	hourCycle: "h23",
	weekday: "short",
	year: "numeric",
	month: "numeric",
	day: "numeric",
	hour: "numeric",
	minute: "numeric",
});

export function GetSwedenParts(timestamp: number): SwedenParts {
	const parts = FORMAT.formatToParts(new Date(timestamp));
	const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

	return {
		year: Number(get("year")),
		month: Number(get("month")),
		day: Number(get("day")),
		hour: Number(get("hour")) % 24,
		minute: Number(get("minute")),
		weekday: WEEKDAYS.indexOf(get("weekday")),
	};
}

function OffsetAt(timestamp: number): number {
	const parts = GetSwedenParts(timestamp);
	const minute = timestamp - (timestamp % 60000);
	return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - minute;
}

export function SwedenToUtc(year: number, month: number, day: number, hour: number, minute: number): number | null {
	const wanted = Date.UTC(year, month - 1, day, hour, minute);
	const first = wanted - OffsetAt(wanted);
	const result = wanted - OffsetAt(first);

	const check = GetSwedenParts(result);
	const matches = check.year === year && check.month === month && check.day === day && check.hour === hour && check.minute === minute;
	return matches ? result : null;
}
