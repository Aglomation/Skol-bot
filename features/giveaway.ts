import { randomInt } from "node:crypto";
import type { Client, Guild, GuildMember, GuildTextBasedChannel } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, DiscordAPIError, EmbedBuilder, RESTJSONErrorCodes } from "discord.js";
import { CreateJsonStore } from "../utils/jsonStore.js";
import { SendLog } from "../utils/logChannel.js";

// People enter a giveaway by pressing the button on its message, the button shows how many have entered
// Discord doesn't keep a list of who pressed a button, so the ids of the people are saved in cache/giveaways.json together with what is needed
// to find the message again. The file is read when the bot starts, so a restart (or a bot that is off when a giveaway ends) loses nothing
const GIVEAWAY_EMOJI = "🎉";
export const GIVEAWAY_BUTTON_ID = "giveaway";

const KEEP_ENDED_MS = 7 * 24 * 60 * 60 * 1000; // an ended giveaway is kept for a while so it can be rerolled
const MAX_ATTEMPTS = 5; // tries to end a giveaway before giving up on it
const FILE = "./cache/giveaways.json";

const COLOR_ACTIVE = 0xf1c40f;
const COLOR_ENDED = 0x95a5a6;

export type Giveaway = {
	messageId: string; // the giveaway message, the button is on it
	channelId: string;
	guildId: string;
	ownerId: string; // who started it
	prize: string;
	winnerCount: number;
	endsAt: number;
	roleId: string | null; // only members with this role can win
	entrants: string[]; // the people who pressed the button (kept until the giveaway is forgotten, so it can be rerolled)
	endedAt: number | null;
	winnerIds: string[];
	attempts: number;
};

const store = CreateJsonStore<{ giveaways: Giveaway[] }>(FILE, () => ({ giveaways: [] }));
const giveaways = new Map<string, Giveaway>();
const finishing = new Set<string>(); // giveaways that are being ended right now, so the tick and /giveaway end can't both do it
let loading: Promise<void> | null = null;
let ticking = false;

const Load = (): Promise<void> =>
	(loading ??= store.Get().then((data) => {
		for (const giveaway of data.giveaways ?? []) {
			giveaways.set(giveaway.messageId, { ...giveaway, entrants: giveaway.entrants ?? [], winnerIds: giveaway.winnerIds ?? [], attempts: giveaway.attempts ?? 0 });
		}
	}));

async function Save(): Promise<void> {
	await Load();
	(await store.Get()).giveaways = [...giveaways.values()];
	await store.Save();
}

export async function GetGiveaways(guildId?: string): Promise<Giveaway[]> {
	await Load();
	return [...giveaways.values()].filter((giveaway) => !guildId || giveaway.guildId === guildId);
}

export async function GetGiveaway(messageId: string): Promise<Giveaway | null> {
	await Load();
	return giveaways.get(messageId) ?? null;
}

export const IsActive = (giveaway: Giveaway): boolean => giveaway.endedAt === null;

export const GiveawayLink = (giveaway: Giveaway): string =>
	`https://discord.com/channels/${giveaway.guildId}/${giveaway.channelId}/${giveaway.messageId}`;

/**
 * Finds a giveaway of a server from a message id or a message link, null if there is none
 */
export async function FindGiveaway(guildId: string, input: string): Promise<Giveaway | null> {
	const messageId = input.trim().match(/(\d{15,25})\/?$/)?.[1];
	if (!messageId) return null;

	const giveaway = (await GetGiveaways(guildId)).find((item) => item.messageId === messageId);
	return giveaway ?? null;
}

/**
 * The giveaways of a server as choices for an autocomplete, the running ones or the ones that ended
 */
export async function GetGiveawayChoices(guildId: string, kind: "active" | "ended", query: string, now = Date.now()) {
	const lower = query.toLowerCase();

	return (await GetGiveaways(guildId))
		.filter((giveaway) => (kind === "active" ? IsActive(giveaway) : !IsActive(giveaway)))
		.filter((giveaway) => !lower || giveaway.prize.toLowerCase().includes(lower) || giveaway.messageId.includes(lower))
		.sort((a, b) => (kind === "active" ? a.endsAt - b.endsAt : (b.endedAt ?? 0) - (a.endedAt ?? 0)))
		.slice(0, 25)
		.map((giveaway) => ({
			name: `${giveaway.prize.slice(0, 70)} (${kind === "active" ? `ends in ${LeftText(giveaway.endsAt - now)}` : "ended"})`,
			value: giveaway.messageId,
		}));
}

function LeftText(ms: number): string {
	const minutes = Math.max(0, Math.round(ms / 60000));
	if (minutes < 1) return "less than a minute";
	if (minutes < 60) return `${minutes}m`;
	if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
	return `${Math.floor(minutes / (24 * 60))}d ${Math.floor((minutes % (24 * 60)) / 60)}h`;
}

const Mentions = (ids: string[]): string => ids.map((id) => `<@${id}>`).join(", ");
const Stamp = (ms: number, style: "R" | "f"): string => `<t:${Math.floor(ms / 1000)}:${style}>`;

/**
 * The message of a giveaway, the same function makes it when it starts and when it has ended
 */
export function BuildGiveawayMessage(giveaway: Giveaway) {
	const lines = IsActive(giveaway)
		? [
				"Press the button to enter, press it again to leave.",
				"",
				`**Ends:** ${Stamp(giveaway.endsAt, "R")} (${Stamp(giveaway.endsAt, "f")})`,
				`**Hosted by:** <@${giveaway.ownerId}>`,
				`**Winners:** ${giveaway.winnerCount}`,
			]
		: [
				`**Ended:** ${Stamp(giveaway.endedAt ?? giveaway.endsAt, "R")}`,
				`**Winners:** ${giveaway.winnerIds.length > 0 ? Mentions(giveaway.winnerIds) : "Nobody, there were no valid entries"}`,
				`**Entries:** ${giveaway.entrants.length}`,
				`**Hosted by:** <@${giveaway.ownerId}>`,
			];
	if (giveaway.roleId && IsActive(giveaway)) lines.push(`**Only for:** <@&${giveaway.roleId}>`);

	return {
		content: IsActive(giveaway) ? `${GIVEAWAY_EMOJI} **GIVEAWAY** ${GIVEAWAY_EMOJI}` : `${GIVEAWAY_EMOJI} **GIVEAWAY ENDED** ${GIVEAWAY_EMOJI}`,
		embeds: [
			new EmbedBuilder()
				.setTitle(giveaway.prize)
				.setDescription(lines.join("\n"))
				.setColor(IsActive(giveaway) ? COLOR_ACTIVE : COLOR_ENDED),
		],
		// the button has the number of people who entered on it, and it is gone when the giveaway has ended
		components:
			IsActive(giveaway)
				? [
						new ActionRowBuilder<ButtonBuilder>().addComponents(
							new ButtonBuilder()
								.setCustomId(GIVEAWAY_BUTTON_ID)
								.setEmoji(GIVEAWAY_EMOJI)
								.setLabel(`Enter (${giveaway.entrants.length})`)
								.setStyle(ButtonStyle.Primary),
						),
					]
				: [],
		// the mentions in it are only for showing, nobody is pinged by editing the message
		allowedMentions: { parse: [] as [] },
	};
}

/**
 * Posts the giveaway with its button, and saves it
 */
export async function StartGiveaway(
	channel: GuildTextBasedChannel,
	input: { ownerId: string; prize: string; endsAt: number; winnerCount: number; roleId: string | null },
): Promise<Giveaway> {
	const giveaway: Giveaway = { ...input, messageId: "", channelId: channel.id, guildId: channel.guild.id, entrants: [], endedAt: null, winnerIds: [], attempts: 0 };

	const message = await channel.send(BuildGiveawayMessage(giveaway));

	giveaway.messageId = message.id;
	giveaways.set(giveaway.messageId, giveaway);
	await Save();
	return giveaway;
}

type EntryResult = { state: "entered" | "left" } | { state: "blocked"; reason: string };

/**
 * Someone pressed the button: they enter, or leave if they had already entered
 * It checks who may enter here, so a person who can't win doesn't end up in the count
 */
export async function ToggleGiveawayEntry(giveaway: Giveaway, member: GuildMember, now = Date.now()): Promise<EntryResult> {
	if (!IsActive(giveaway)) return { state: "blocked", reason: "This giveaway has ended." };
	// the time is up, the winners are drawn by the next check (at most 15 seconds later)
	if (now >= giveaway.endsAt) return { state: "blocked", reason: "This giveaway is over, the winners are drawn in a moment." };
	if (giveaway.roleId && !member.roles.cache.has(giveaway.roleId)) return { state: "blocked", reason: `Only members with <@&${giveaway.roleId}> can enter this giveaway.` };

	// everything up to the save happens without waiting, so two presses at the same moment can't both think they were first
	const entered = giveaway.entrants.includes(member.id);
	giveaway.entrants = entered ? giveaway.entrants.filter((id) => id !== member.id) : [...giveaway.entrants, member.id];
	await Save();

	return { state: entered ? "left" : "entered" };
}

/**
 * Picks winners at random from the people who entered (not the host) and are still in the server (and have the role, if it needs one)
 * @param exclude People who can't win, the earlier winners when it is rerolled
 */
async function DrawWinners(guild: Guild, giveaway: Giveaway, count: number, exclude: string[]): Promise<string[]> {
	const entrants = giveaway.entrants.filter((id) => id !== giveaway.ownerId && !exclude.includes(id));

	// a fair shuffle, with randomInt from crypto and not Math.random
	for (let i = entrants.length - 1; i > 0; i--) {
		const j = randomInt(i + 1);
		[entrants[i], entrants[j]] = [entrants[j], entrants[i]];
	}

	const winners: string[] = [];
	// the members are looked up 100 at a time in the shuffled order, so a big giveaway doesn't need a request per person
	for (let start = 0; start < entrants.length && winners.length < count; start += 100) {
		const chunk = entrants.slice(start, start + 100);
		// if this fails the error goes up, the giveaway is tried again later, and not ended as if nobody could win
		const members = await guild.members.fetch({ user: chunk });

		for (const id of chunk) {
			const member = members.get(id);
			if (!member || (giveaway.roleId && !member.roles.cache.has(giveaway.roleId))) continue;

			winners.push(id);
			if (winners.length >= count) break;
		}
	}

	return winners;
}

async function FetchChannel(client: Client, giveaway: Giveaway): Promise<GuildTextBasedChannel | null> {
	const channel = await client.channels.fetch(giveaway.channelId);
	return channel?.isTextBased() && !channel.isDMBased() ? channel : null;
}

// the channel or the message was deleted, so there is nothing to end
function IsGone(error: unknown): boolean {
	return error instanceof DiscordAPIError && (error.code === RESTJSONErrorCodes.UnknownChannel || error.code === RESTJSONErrorCodes.UnknownMessage);
}

async function Announce(channel: GuildTextBasedChannel, giveaway: Giveaway, winners: string[], again: boolean): Promise<void> {
	const content =
		winners.length === 0
			? `${GIVEAWAY_EMOJI} Nobody won **${giveaway.prize}**, there were no valid entries.`
			: `${GIVEAWAY_EMOJI} ${again ? "New winner" : "Congratulations"} ${Mentions(winners)}! You won **${giveaway.prize}**!`;

	await channel
		.send({
			content,
			reply: { messageReference: giveaway.messageId, failIfNotExists: false },
			// only the winners are pinged, a prize like "@everyone" is only text
			allowedMentions: { users: winners, repliedUser: false },
		})
		.catch((error) => console.error("Could not announce a giveaway:", error));
}

// the message or the channel is gone (or isn't a text channel), so nobody can be drawn
async function GiveUp(client: Client, giveaway: Giveaway, now: number): Promise<string[]> {
	giveaway.endedAt = now;
	giveaway.winnerIds = [];
	await Save();
	await SendLog(client, giveaway.guildId, `The giveaway for **${giveaway.prize}** could not be ended, the message or the channel was deleted.`);
	return [];
}

/**
 * Ends a giveaway: draws the winners, edits the message and announces them
 * @returns The winners (none if nobody could win), null if it was already ended or is being ended
 */
export async function FinishGiveaway(client: Client, giveaway: Giveaway, now = Date.now()): Promise<string[] | null> {
	if (!IsActive(giveaway) || finishing.has(giveaway.messageId)) return null;
	finishing.add(giveaway.messageId);

	try {
		const channel = await FetchChannel(client, giveaway);
		if (!channel) return await GiveUp(client, giveaway, now);

		const message = await channel.messages.fetch(giveaway.messageId);

		const winners = await DrawWinners(channel.guild, giveaway, giveaway.winnerCount, []);

		// saved before the announcement: if something goes wrong after this the winners stay the same instead of being drawn again
		giveaway.winnerIds = winners;
		giveaway.endedAt = now;
		await Save();

		await message.edit(BuildGiveawayMessage(giveaway)).catch((error) => console.error("Could not edit a giveaway:", error));
		await Announce(channel, giveaway, winners, false);
		await SendLog(client, giveaway.guildId, `The giveaway for **${giveaway.prize}** ended. Winners: ${winners.length > 0 ? Mentions(winners) : "nobody"}. ${GiveawayLink(giveaway)}`);

		return winners;
	} catch (error) {
		if (!IsGone(error)) throw error;

		return await GiveUp(client, giveaway, now);
	} finally {
		finishing.delete(giveaway.messageId);
	}
}

/**
 * Draws new winners for a giveaway that has ended, the earlier winners can't win again
 * @returns The new winners, none if nobody else could win
 */
export async function RerollGiveaway(client: Client, giveaway: Giveaway, count: number): Promise<string[]> {
	const channel = await FetchChannel(client, giveaway);
	if (!channel) return [];

	const winners = await DrawWinners(channel.guild, giveaway, count, giveaway.winnerIds);
	if (winners.length === 0) return [];

	giveaway.winnerIds.push(...winners);
	await Save();
	await Announce(channel, giveaway, winners, true);
	await SendLog(client, giveaway.guildId, `The giveaway for **${giveaway.prize}** was rerolled. New winners: ${Mentions(winners)}. ${GiveawayLink(giveaway)}`);
	return winners;
}

/**
 * Stops a running giveaway without a winner and deletes its message
 */
export async function CancelGiveaway(client: Client, giveaway: Giveaway): Promise<void> {
	const channel = await FetchChannel(client, giveaway).catch(() => null);
	await channel?.messages.delete(giveaway.messageId).catch(() => null);

	giveaways.delete(giveaway.messageId);
	await Save();
}

/**
 * Moves the end of a running giveaway later, and puts the new time on its message
 * The time has to be changed before the message is made, the message shows the time it is made with
 */
export async function ExtendGiveaway(client: Client, giveaway: Giveaway, durationMs: number): Promise<boolean> {
	giveaway.endsAt += durationMs;
	await Save();

	const channel = await FetchChannel(client, giveaway).catch(() => null);
	const edited = await channel?.messages.edit(giveaway.messageId, BuildGiveawayMessage(giveaway)).then(
		() => true,
		() => false,
	);

	return edited ?? false;
}

/**
 * A person's ids are removed from the giveaways (/privacy deleteme), both as an entrant and as a winner, the giveaways themselves stay
 */
export async function RemoveUserFromGiveaways(guildId: string, userId: string): Promise<void> {
	let changed = false;
	for (const giveaway of await GetGiveaways(guildId)) {
		if (giveaway.winnerIds.includes(userId) || giveaway.entrants.includes(userId)) {
			giveaway.winnerIds = giveaway.winnerIds.filter((id) => id !== userId);
			giveaway.entrants = giveaway.entrants.filter((id) => id !== userId);
			changed = true;
		}
	}

	if (changed) await Save();
}

/**
 * The giveaways a person won, for /privacy mydata
 */
export async function GetGiveawaysWonBy(guildId: string, userId: string): Promise<Giveaway[]> {
	return (await GetGiveaways(guildId)).filter((giveaway) => giveaway.winnerIds.includes(userId));
}

/**
 * The giveaways a person entered, for /privacy mydata
 */
export async function GetGiveawaysEnteredBy(guildId: string, userId: string): Promise<Giveaway[]> {
	return (await GetGiveaways(guildId)).filter((giveaway) => giveaway.entrants.includes(userId));
}

/**
 * Ends the giveaways whose time has run out (also the ones that ran out while the bot was off) and forgets the old ones
 */
export async function RunGiveawayTick(client: Client, now = Date.now()): Promise<void> {
	if (ticking) return;
	ticking = true;

	try {
		let changed = false;
		for (const giveaway of await GetGiveaways()) {
			if (!IsActive(giveaway)) {
				if (now - (giveaway.endedAt ?? now) > KEEP_ENDED_MS) {
					giveaways.delete(giveaway.messageId);
					changed = true;
				}
				continue;
			}

			if (now < giveaway.endsAt) continue;
			// during an outage the server isn't there, it is not a reason to give up on the giveaway
			if (!client.guilds.cache.has(giveaway.guildId)) continue;

			try {
				await FinishGiveaway(client, giveaway, now);
			} catch (error) {
				giveaway.attempts++;
				console.error(`Could not end a giveaway (try ${giveaway.attempts} of ${MAX_ATTEMPTS}):`, error);
				if (giveaway.attempts >= MAX_ATTEMPTS) {
					giveaway.endedAt = now;
					await SendLog(client, giveaway.guildId, `The giveaway for **${giveaway.prize}** could not be ended after ${MAX_ATTEMPTS} tries. Use \`/giveaway reroll\` or draw the winner by hand: ${GiveawayLink(giveaway)}`);
				}
				changed = true;
			}
		}

		if (changed) await Save();
	} finally {
		ticking = false;
	}
}
