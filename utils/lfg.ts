import type { Client, GuildTextBasedChannel } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { CreateJsonStore } from "./jsonStore.js";
import { ParseDuration } from "./stringConvert.js";
import type { SwedenParts } from "./swedenTime.js";
import { GetSwedenParts, SwedenToUtc } from "./swedenTime.js";

export const LFG_BUTTON_ID = "lfg";

export const REMIND_BEFORE_MS = 10 * 60 * 1000;
export const END_AFTER_MS = 3 * 60 * 60 * 1000;

const KEEP_CLOSED_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LISTED = 40;
const FILE = "./cache/lfg.json";

const DEFAULT_GAMES = [
	"Minecraft",
	"Valorant",
	"League of Legends",
	"Counter-Strike 2",
	"Fortnite",
	"Rocket League",
	"Overwatch 2",
	"Apex Legends",
	"Among Us",
	"Mario Kart",
];

export type LfgStatus = "open" | "started" | "ended" | "cancelled";
export type Signup = "join" | "maybe" | "leave";

export type LfgSession = {
	id: string;
	guildId: string;
	channelId: string;
	hostId: string;
	game: string;
	note: string | null;
	startsAt: number;
	maxPlayers: number | null;
	going: string[];
	maybe: string[];
	waitlist: string[];
	status: LfgStatus;
	remindedAt: number | null;
	startedAt: number | null;
	closedAt: number | null;
	createdAt: number;
};

const store = CreateJsonStore<{ sessions: LfgSession[] }>(FILE, () => ({ sessions: [] }));
const WEEKDAY_NAMES: Record<string, number> = {
	sunday: 0, sun: 0, söndag: 0, sön: 0,
	monday: 1, mon: 1, måndag: 1, mån: 1,
	tuesday: 2, tue: 2, tisdag: 2, tis: 2,
	wednesday: 3, wed: 3, onsdag: 3, ons: 3,
	thursday: 4, thu: 4, torsdag: 4, tor: 4,
	friday: 5, fri: 5, fredag: 5, fre: 5,
	saturday: 6, sat: 6, lördag: 6, lör: 6,
};

const sessions = new Map<string, LfgSession>();
let loading: Promise<void> | null = null;
let ticking = false;

const Load = (): Promise<void> =>
	(loading ??= store.Get().then((data) => {
		for (const session of data.sessions ?? []) sessions.set(session.id, session);
	}));

export async function SaveSessions(): Promise<void> {
	await Load();
	(await store.Get()).sessions = [...sessions.values()];
	await store.Save();
}

export async function GetSession(id: string): Promise<LfgSession | null> {
	await Load();
	return sessions.get(id) ?? null;
}

export async function GetSessions(guildId?: string): Promise<LfgSession[]> {
	await Load();
	return [...sessions.values()].filter((session) => !guildId || session.guildId === guildId);
}

export async function AddSession(session: LfgSession): Promise<void> {
	await Load();
	sessions.set(session.id, session);
	await SaveSessions();
}

export const IsActive = (session: LfgSession) => session.status === "open" || session.status === "started";

export async function GetUpcoming(guildId: string): Promise<LfgSession[]> {
	return (await GetSessions(guildId)).filter(IsActive).sort((a, b) => a.startsAt - b.startsAt);
}

export async function GetGameSuggestions(guildId: string, typed: string): Promise<string[]> {
	const counts = new Map<string, number>();
	for (const session of await GetSessions(guildId)) counts.set(session.game, (counts.get(session.game) ?? 0) + 1);

	const known = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([game]) => game);
	const query = typed.trim().toLowerCase();

	return [...new Set([...known, ...DEFAULT_GAMES])]
		.filter((game) => game.toLowerCase().includes(query))
		.slice(0, 25);
}

export function ApplySignup(session: LfgSession, userId: string, choice: Signup): { outcome: "going" | "waitlist" | "maybe" | "left"; promoted: string | null } {
	if (choice === "join" && session.going.includes(userId)) return { outcome: "going", promoted: null };
	if (choice === "join" && session.waitlist.includes(userId)) return { outcome: "waitlist", promoted: null };

	const hadSpot = session.going.includes(userId);
	session.going = session.going.filter((id) => id !== userId);
	session.maybe = session.maybe.filter((id) => id !== userId);
	session.waitlist = session.waitlist.filter((id) => id !== userId);

	let outcome: "going" | "waitlist" | "maybe" | "left" = "left";

	if (choice === "join") {
		if (session.maxPlayers !== null && session.going.length >= session.maxPlayers) {
			session.waitlist.push(userId);
			outcome = "waitlist";
		} else {
			session.going.push(userId);
			outcome = "going";
		}
	} else if (choice === "maybe") {
		session.maybe.push(userId);
		outcome = "maybe";
	}

	let promoted: string | null = null;
	if (hadSpot && outcome !== "going" && session.waitlist.length > 0) {
		promoted = session.waitlist.shift() as string;
		session.going.push(promoted);
	}

	return { outcome, promoted };
}

const Seconds = (timestamp: number) => Math.floor(timestamp / 1000);

function List(ids: string[]): string {
	if (ids.length === 0) return "Nobody yet";

	const shown = ids.slice(0, MAX_LISTED).map((id) => `<@${id}>`).join("\n");
	return ids.length > MAX_LISTED ? `${shown}\n+${ids.length - MAX_LISTED} more` : shown;
}

export function BuildEmbed(session: LfgSession): EmbedBuilder {
	const isFull = session.maxPlayers !== null && session.going.length >= session.maxPlayers;
	const slots = session.maxPlayers === null ? `${session.going.length}` : `${session.going.length}/${session.maxPlayers}`;

	const colors: Record<LfgStatus, number> = { open: isFull ? 0xe67e22 : 0x2ecc71, started: 0x3498db, ended: 0x95a5a6, cancelled: 0xe74c3c };
	const footers: Record<LfgStatus, string> = {
		open: isFull ? "Full, press I'm in to join the waitlist" : "Press a button to sign up",
		started: "Started, you can still join",
		ended: "This session is over",
		cancelled: "Cancelled",
	};

	const embed = new EmbedBuilder()
		.setTitle(`🎮 ${session.game}`)
		.setColor(colors[session.status])
		.setDescription(
			[
				`**When:** <t:${Seconds(session.startsAt)}:F> (<t:${Seconds(session.startsAt)}:R>)`,
				`**Host:** <@${session.hostId}>`,
				...(session.note ? ["", session.note] : []),
			].join("\n"),
		)
		.addFields({ name: `✅ Going (${slots})`, value: List(session.going), inline: true });

	if (session.waitlist.length > 0) embed.addFields({ name: `⏳ Waitlist (${session.waitlist.length})`, value: List(session.waitlist), inline: true });
	if (session.maybe.length > 0) embed.addFields({ name: `❔ Maybe (${session.maybe.length})`, value: List(session.maybe), inline: true });

	return embed.setFooter({ text: footers[session.status] });
}

export function BuildRows(session: LfgSession): ActionRowBuilder<ButtonBuilder>[] {
	if (!IsActive(session)) return [];

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId(`${LFG_BUTTON_ID}:join`).setLabel("I'm in").setEmoji("✅").setStyle(ButtonStyle.Success),
		new ButtonBuilder().setCustomId(`${LFG_BUTTON_ID}:maybe`).setLabel("Maybe").setEmoji("❔").setStyle(ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId(`${LFG_BUTTON_ID}:leave`).setLabel("Out").setEmoji("❌").setStyle(ButtonStyle.Secondary),
	);

	if (session.status === "open") {
		row.addComponents(new ButtonBuilder().setCustomId(`${LFG_BUTTON_ID}:start`).setLabel("Start now").setEmoji("▶️").setStyle(ButtonStyle.Primary));
	}

	row.addComponents(new ButtonBuilder().setCustomId(`${LFG_BUTTON_ID}:cancel`).setLabel("Cancel").setEmoji("🗑️").setStyle(ButtonStyle.Danger));
	return [row];
}

function Mentions(ids: string[]): string {
	return ids.slice(0, 60).map((id) => `<@${id}>`).join(" ");
}

function GetChannel(client: Client, session: LfgSession): GuildTextBasedChannel | null {
	const channel = client.channels.cache.get(session.channelId);
	if (!channel?.isTextBased() || channel.isDMBased()) return null;
	return channel as GuildTextBasedChannel;
}

const IsUnknownMessage = (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === 10008;

async function Say(channel: GuildTextBasedChannel, session: LfgSession, content: string, ids: string[]): Promise<void> {
	await channel
		.send({ content, allowedMentions: { users: ids.slice(0, 60) }, reply: { messageReference: session.id, failIfNotExists: false } })
		.catch((error) => console.error("Could not send the LFG message:", error));
}

export async function RefreshMessage(client: Client, session: LfgSession): Promise<void> {
	const channel = GetChannel(client, session);
	if (!channel) return;

	try {
		await channel.messages.edit(session.id, { embeds: [BuildEmbed(session)], components: BuildRows(session) });
	} catch (error) {
		if (IsUnknownMessage(error)) {
			session.status = "ended";
			session.closedAt = Date.now();
			await SaveSessions();
		} else {
			console.error("Could not update the LFG message:", error);
		}
	}
}

export async function StartSession(client: Client, session: LfgSession, now = Date.now()): Promise<void> {
	if (session.status !== "open") return;

	session.status = "started";
	session.startedAt = now;
	session.startsAt = Math.min(session.startsAt, now);
	await SaveSessions();

	const channel = GetChannel(client, session);
	if (channel) {
		const maybeNote = session.maybe.length > 0 ? `\n${Mentions(session.maybe)} you can still join with the button.` : "";
		await Say(channel, session, `🎮 Time to play **${session.game}**!\n${Mentions(session.going)}${maybeNote}`, [...session.going, ...session.maybe]);
	}
	await RefreshMessage(client, session);
}

export async function CancelSession(client: Client, session: LfgSession, byId: string): Promise<void> {
	session.status = "cancelled";
	session.closedAt = Date.now();
	await SaveSessions();

	const channel = GetChannel(client, session);
	const others = [...session.going, ...session.waitlist].filter((id) => id !== byId);
	if (channel) await Say(channel, session, `🗑️ **${session.game}** was cancelled by <@${byId}>.${others.length > 0 ? `\n${Mentions(others)}` : ""}`, others);
}

export async function RemoveUserFromLfg(client: Client, guildId: string, userId: string): Promise<void> {
	for (const session of await GetSessions(guildId)) {
		if (session.hostId === userId) {
			await GetChannel(client, session)?.messages.delete(session.id).catch(() => null);
			sessions.delete(session.id);
			continue;
		}

		if (![...session.going, ...session.maybe, ...session.waitlist].includes(userId)) continue;

		ApplySignup(session, userId, "leave");
		if (IsActive(session)) await RefreshMessage(client, session);
	}

	await SaveSessions();
}

export async function RunLfgTick(client: Client, now = Date.now()): Promise<void> {
	if (ticking) return;
	ticking = true;

	try {
		for (const session of await GetSessions()) {
			if (!IsActive(session)) {
				if (session.closedAt !== null && now - session.closedAt > KEEP_CLOSED_MS) {
					sessions.delete(session.id);
					await SaveSessions();
				}
				continue;
			}

			if (!client.guilds.cache.has(session.guildId)) continue;

			const channel = GetChannel(client, session);
			if (!channel) {
				session.status = "ended";
				session.closedAt = now;
				await SaveSessions();
				continue;
			}

			if (session.status === "open" && now >= session.startsAt) {
				await StartSession(client, session, now);
				continue;
			}

			if (session.status === "open" && session.remindedAt === null && now >= session.startsAt - REMIND_BEFORE_MS) {
				session.remindedAt = now;
				await SaveSessions();

				const ids = [...session.going, ...session.maybe];
				const maybeNote = session.maybe.length > 0 ? "\nMaybe? Press ✅ if you're coming." : "";
				await Say(channel, session, `⏰ **${session.game}** starts <t:${Seconds(session.startsAt)}:R>!\n${Mentions(ids)}${maybeNote}`, ids);
				continue;
			}

			if (session.status === "started" && now >= (session.startedAt ?? session.startsAt) + END_AFTER_MS) {
				session.status = "ended";
				session.closedAt = now;
				await SaveSessions();
				await RefreshMessage(client, session);
			}
		}
	} finally {
		ticking = false;
	}
}

function AtDayOffset(today: SwedenParts, offset: number, hour: number, minute: number): number | null {
	const base = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
	return SwedenToUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), hour, minute);
}

// Crazy ai regex
export function ParseWhen(input: string, now = Date.now()): number | null {
	const text = input.trim().toLowerCase().replace(/\s+/g, " ");
	if (text === "now" || text === "nu") return now;

	const relative = text.match(/^(?:in|om) (.+)$/);
	if (relative) {
		const duration = ParseDuration(relative[1]);
		return duration !== null && Number.isFinite(duration) ? now + duration : null;
	}

	const full = text.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{1,2})[:.](\d{2})$/);
	if (full) {
		const [year, month, day, hour, minute] = full.slice(1).map(Number);
		if (hour > 23 || minute > 59) return null;
		return SwedenToUtc(year, month, day, hour, minute);
	}

	const match = text.match(/^(?:(\p{L}+) )?(\d{1,2})[:.](\d{2})$/u);
	if (!match) return null;

	const hour = Number(match[2]);
	const minute = Number(match[3]);
	if (hour > 23 || minute > 59) return null;

	const word = match[1];
	const today = GetSwedenParts(now);

	if (!word) {
		const candidate = AtDayOffset(today, 0, hour, minute);
		if (candidate !== null && candidate > now) return candidate;
		return AtDayOffset(today, 1, hour, minute);
	}
	if (word === "today" || word === "idag") return AtDayOffset(today, 0, hour, minute);
	if (word === "tomorrow" || word === "imorgon") return AtDayOffset(today, 1, hour, minute);

	const weekday = WEEKDAY_NAMES[word];
	if (weekday === undefined) return null;

	const days = (weekday - today.weekday + 7) % 7;
	const candidate = AtDayOffset(today, days, hour, minute);
	if (days === 0 && candidate !== null && candidate <= now) return AtDayOffset(today, 7, hour, minute);
	return candidate;
}
