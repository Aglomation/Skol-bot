import fs from "node:fs/promises";
import path from "node:path";

const CACHE_DIR = "./cache";
const CACHE_FILE = path.join(CACHE_DIR, "polisen.json");

export interface PolisenEvent {
	id: number; // 645957
	datetime: string; // "2026-07-02 11:57:10 +02:00"
	name: string; // "2 juli 11.31, Brand, Nyköping"
	summary: string; // "Brand i flerbostadshus, Nyköping"
	url: string; // "/aktuellt/handelser/2026/juli/2/2-juli-11.31-brand-nykoping/"
	type: string; // "Brand"
	location: {
		name: string; // "Södermanlands län"
		gps: string; // "59.033635,16.75189"
	};
}

const SWEDISH_MONTHS = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];

/**
 * Reads the datetime of an event ("2026-10-07 18:30:20 +02:00")
 * Not every runtime reads that format, so it is turned into ISO 8601 first
 */
export function ParsePolisenTime(datetime: string): Date {
	return new Date(datetime.replace(" ", "T").replace(" ", ""));
}

/**
 * When the event happened, that is in the name ("7 oktober 16.33, Trafikolycka, Uppsala")
 * The datetime of the event is when it was published
 * @returns null if the name has no time in it
 */
export function GetEventTime(event: PolisenEvent): Date | null {
	const match = event.name.match(/^(\d{1,2}) (\p{L}+) (\d{1,2})\.(\d{2})/u);
	const month = SWEDISH_MONTHS.indexOf(match?.[2].toLowerCase() ?? "");
	if (!match || month === -1) return null;

	const published = ParsePolisenTime(event.datetime);
	const offset = event.datetime.slice(-6); // "+02:00"
	const at = (year: number) => new Date(
		`${year}-${String(month + 1).padStart(2, "0")}-${match[1].padStart(2, "0")}T${match[3].padStart(2, "0")}:${match[4]}:00${offset}`,
	);

	// it happened before it was published, so one that comes out later is from the year before (published on new years)
	let time = at(Number(event.datetime.slice(0, 4)));
	if (time.getTime() > published.getTime() + 24 * 60 * 60 * 1000) time = at(Number(event.datetime.slice(0, 4)) - 1);

	return Number.isNaN(time.getTime()) ? null : time;
}

/**
 * The url of an event is a path on polisen.se, it is put after the host so it can't be anything else (like "@other.site")
 */
export function IsEventPath(url: unknown): url is string {
	return typeof url === "string" && /^\/[^\s\\]*$/.test(url) && !url.startsWith("//");
}

/**
 * Loads the existing cache file into an Array.
 */
export async function LoadPolisenCache(): Promise<PolisenEvent[]> {
	try {
		await fs.mkdir(CACHE_DIR, { recursive: true });
		const data = await fs.readFile(CACHE_FILE, "utf-8");
		return JSON.parse(data);
	} catch {
		return []; // Return empty array if file doesn't exist or is invalid
	}
}
/**
 * Saves the Array values back to the cache file.
 */
export async function SavePolisenCache(data: PolisenEvent[]): Promise<void> {
	// written to another file first and then renamed, so the button never reads a half written cache
	const tempFile = `${CACHE_FILE}.tmp`;
	await fs.writeFile(tempFile, JSON.stringify(data, null, 0));
	await fs.rename(tempFile, CACHE_FILE);
}
