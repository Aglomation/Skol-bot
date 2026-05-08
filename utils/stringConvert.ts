/**
 * Converts a string like "1d 2h 30m" into milliseconds.
 * @param input The input string to convert
 * @returns Number of milliseconds or null if invalid
 */
export function stringToDate(input: string): number | null {
	if (!input) return null;
	const cleaned = String(input).replace(/[()\s]/g, "");
	const re = /(\d+)(inf|y|mo|ms|d|h|m|s)/g;
	const multipliers: Record<string, number> = {
		ms: 1,
		s: 1000,
		m: 60 * 1000,
		h: 60 * 60 * 1000,
		d: 24 * 60 * 60 * 1000,
		mo: 30 * 24 * 60 * 60 * 1000,
		y: 365 * 24 * 60 * 60 * 1000,
		inf: Infinity,
	};

	let totalMs = 0;
	let match: RegExpExecArray | null;
	match = re.exec(cleaned);
	while (match !== null) {
		const value = parseInt(match[1], 10) || 0;
		const unit = match[2];
		if (!Number.isNaN(value) && multipliers[unit]) {
			totalMs += value * multipliers[unit];
		}
		match = re.exec(cleaned);
	}

	return totalMs ? totalMs : null;
}
/**
 * Converts a month number (1-12) to its corresponding month name. Overflow rolls over (13 -> January)
 * @param input The input month number (1-12)
 * @returns The corresponding month name or "Unknown" if invalid
 */
export function numToMonth(input: number): string {
	switch (((input - 1) % 12) + 1) {
		case 1:
			return "January";
		case 2:
			return "February";
		case 3:
			return "March";
		case 4:
			return "April";
		case 5:
			return "May";
		case 6:
			return "June";
		case 7:
			return "July";
		case 8:
			return "August";
		case 9:
			return "September";
		case 10:
			return "October";
		case 11:
			return "November";
		case 12:
			return "December";
		default:
			return "Unknown";
	}
}
