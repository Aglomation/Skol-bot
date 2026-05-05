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
	const match: RegExpExecArray | null = re.exec(cleaned)
	while (match !== null) {
		const value = parseInt(match[1], 10) || 0;
		const unit = match[2];
		if (!Number.isNaN(value) && multipliers[unit]) {
			totalMs += value * multipliers[unit];
		}
	}

	return Number.isFinite(totalMs) ? totalMs : null;
}
