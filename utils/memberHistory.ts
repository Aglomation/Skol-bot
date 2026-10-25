import type { Guild } from "discord.js";
import { GetFullServerConfig } from "./configManager.js";
import { CreateJsonStore } from "./jsonStore.js";
import { GetSwedenParts } from "./swedenTime.js";
import { CITIES } from "./verifyOptions.js";

export type Snapshot = {
	total: number;
	cities: Record<string, number>;
};

type History = Record<string, Record<string, Snapshot>>;

const FILE = "./cache/member-history.json";
const KEEP_DAYS = 180;
const SPARKS = "▁▂▃▄▅▆▇█";
const MAX_POINTS = 14;

const store = CreateJsonStore<History>(FILE, () => ({}));

export const GetDateKey = (timestamp: number) => {
	const parts = GetSwedenParts(timestamp);
	return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
};

/**
 * Saves how many verified members each city has today
 * @returns false if the server has no verified role
 */
export async function RecordSnapshot(guild: Guild, now = Date.now()): Promise<boolean> {
	const verifiedRoleId = (await GetFullServerConfig(guild.id))?.verifiedRoleId;
	if (!verifiedRoleId) return false;

	await guild.members.fetch();
	const verified = guild.roles.cache.get(verifiedRoleId);
	if (!verified) return false;

	const cities: Record<string, number> = {};
	for (const city of CITIES) {
		const role = city.roleId ? guild.roles.cache.get(city.roleId) : undefined;
		cities[city.label] = role ? role.members.filter((member) => member.roles.cache.has(verifiedRoleId)).size : 0;
	}

	const all = await store.Get();
	const days = (all[guild.id] ??= {});
	days[GetDateKey(now)] = { total: verified.members.size, cities };

	const oldest = GetDateKey(now - KEEP_DAYS * 86400000);
	for (const day of Object.keys(days)) {
		if (day < oldest) delete days[day];
	}

	await store.Save();
	return true;
}

export async function GetSnapshots(guildId: string, days: number, now = Date.now()): Promise<[string, Snapshot][]> {
	const since = GetDateKey(now - (days - 1) * 86400000);
	const entries = Object.entries((await store.Get())[guildId] ?? {}).filter(([day]) => day >= since);
	return entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

export function Sparkline(values: number[]): string {
	const step = Math.max(1, Math.ceil(values.length / MAX_POINTS));
	const points = values.filter((_, index) => (values.length - 1 - index) % step === 0);

	const min = Math.min(...points);
	const max = Math.max(...points);
	if (max === min) return SPARKS[3].repeat(points.length);

	return points.map((value) => SPARKS[Math.round(((value - min) / (max - min)) * (SPARKS.length - 1))]).join("");
}

const Signed = (value: number) => (value > 0 ? `+${value}` : `${value}`);

/**
 * One line per city, the busiest growth first, with a small chart of the days
 */
export function FormatGrowth(snapshots: [string, Snapshot][]): string[] {
	const rows = [
		{ name: "Total", values: snapshots.map(([, snapshot]) => snapshot.total) },
		...CITIES.map((city) => ({ name: city.label, values: snapshots.map(([, snapshot]) => snapshot.cities[city.label] ?? 0) })),
	];

	const width = Math.max(...rows.map((row) => row.name.length));
	const change = (values: number[]) => values[values.length - 1] - values[0];
	const [total, ...cities] = rows;

	return [total, ...cities.sort((a, b) => change(b.values) - change(a.values) || b.values[b.values.length - 1] - a.values[a.values.length - 1])].map(
		(row) => `${row.name.padEnd(width)}  ${Sparkline(row.values)}  ${Signed(change(row.values)).padStart(4)}  (${row.values[0]}→${row.values[row.values.length - 1]})`,
	);
}
