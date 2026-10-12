/**
 * Converts a string like "1d 2h 30m" into milliseconds.
 * @param input The input string to convert
 * @returns Number of milliseconds (Infinity for inf) or null if invalid
 */
export function parseDuration(input: string): number | null {
	if (!input || input === "0") return null;

	const cleaned = String(input).replace(/[()\s]/g, "");

	const validFormat = /^(?:inf|\d+(?:ms|s|m|h|d|w|mo|y))+$/.test(cleaned);
	if (!validFormat) return null;

	const re = /(\d*)(inf|y|mo|ms|d|h|m|s|w)/g;

	const multipliers: Record<string, number> = {
		ms: 1,
		s: 1000,
		m: 60 * 1000,
		h: 60 * 60 * 1000,
		d: 24 * 60 * 60 * 1000,
		w: 7 * 24 * 60 * 60 * 1000,
		mo: 30 * 24 * 60 * 60 * 1000,
		y: 365 * 24 * 60 * 60 * 1000,
		inf: Infinity,
	};

	let totalMs = 0;
	let match: RegExpExecArray | null;
	
	match = re.exec(cleaned);
	while (match !== null) {
		const unit = match[2];
		if (unit === "inf") return Infinity;

		const value = match[1] ? parseInt(match[1], 10) : 1;
		
		if (!Number.isNaN(value) && multipliers[unit]) {
			totalMs += value * multipliers[unit];
		}
		match = re.exec(cleaned);
		
	}

	return totalMs ? totalMs : null;
}

// The old name, it gives a duration and not a date. Kept so older code keeps working
export const stringToDate = parseDuration;

/**
 * Converts a month number (1-12) to its corresponding month name. Overflow rolls over (13 -> January)
 * @param input The input month number (1-12)
 * @returns The corresponding month name or "Unknown" if invalid
 */
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

export function numToMonth(input: number): string {
	return MONTHS[(((input - 1) % 12) + 12) % 12] ?? "Unknown";
}

export function uppercaseFirstLetter(input: string, onlyFirst?: boolean): string {
	if (!input) return input;
	const cleaned = input.trim().replace(/[_]/g, " ");
	if (onlyFirst) {
		return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
	}
	
	return cleaned
		.split(/\s+/g)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}