import { and, eq, or, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import type { ModAction, ModActionType } from "../db/schema.js";
import { userProfileTable } from "../db/schema.js";

export type { ModAction, ModActionType };

// Anything with a moderation list works, so a full profile can be passed in directly
type HasModeration = { moderation?: ModAction[] | null } | null | undefined;

// Timeout removals done by the bot itself (unmute, void...) so the guildMemberUpdate event doesnt log them a second time
const ignoredTimeoutChanges = new Map<string, number>();

/**
 * Call this right before the bot removes a timeout itself
 */
export function IgnoreTimeoutChange(userId: string): void {
	ignoredTimeoutChanges.set(userId, Date.now() + 15 * 1000);
}

export function IsTimeoutChangeIgnored(userId: string): boolean {
	const expires = ignoredTimeoutChanges.get(userId);
	if (!expires) return false;
	ignoredTimeoutChanges.delete(userId);
	return expires > Date.now();
}

export type NumberedAction = { number: number; action: ModAction };
export type ServerAction = NumberedAction & { userId: string };

/**
 * Turns a duration from stringToDate into the time it ends
 * @returns The end time in ms, or null if it never ends (inf)
 */
export function UntilFromDuration(duration: number): number | null {
	return Number.isFinite(duration) ? Date.now() + duration : null;
}

/**
 * Adds an action to a users moderation list, makes the profile if it doesnt exist
 * Done in one query so two mods at the same time cant overwrite each other
 * @returns The case number, or null if it failed to save
 */
export async function AddModAction(
	discordId: string,
	serverId: string,
	action: Omit<ModAction, "at">,
): Promise<number | null> {
	const entry: ModAction = { at: Date.now(), ...action };

	try {
		const [row] = await db.insert(userProfileTable)
			.values({ discordId, serverId, moderation: [entry] })
			.onConflictDoUpdate({
				target: [userProfileTable.discordId, userProfileTable.serverId],
				set: { moderation: sql`${userProfileTable.moderation} || ${JSON.stringify([entry])}::jsonb` },
			})
			.returning({ count: sql<number>`jsonb_array_length(${userProfileTable.moderation})` });

		return Number(row.count);
	} catch (error) {
		console.error("Error adding mod action:", error);
		return null;
	}
}

/**
 * Voids a case, it stays in the history but doesnt count anymore
 * @param number The case number (1 is the first one)
 * @returns true if it was voided
 */
export async function VoidModAction(
	discordId: string,
	serverId: string,
	number: number,
	by: string,
	reason: string,
): Promise<boolean> {
	const index = number - 1;
	const patch = { voided: { by, at: Date.now(), reason } };

	try {
		const result = await db.update(userProfileTable)
			.set({
				moderation: sql`jsonb_set(${userProfileTable.moderation}, ARRAY[${index}::text], (${userProfileTable.moderation} -> ${index}::int) || ${JSON.stringify(patch)}::jsonb)`,
			})
			.where(and(
				eq(userProfileTable.discordId, discordId),
				eq(userProfileTable.serverId, serverId),
				sql`jsonb_array_length(${userProfileTable.moderation}) > ${index}::int`,
				sql`NOT (${userProfileTable.moderation} -> ${index}::int) ? 'voided'`,
			))
			.returning({ id: userProfileTable.id });

		return result.length > 0;
	} catch (error) {
		console.error("Error voiding mod action:", error);
		return false;
	}
}

/**
 * Gets everyone in a server that has moderation history
 * @param types Only get people that have at least one of these types
 */
export async function GetModProfiles(
	serverId: string,
	types?: ModActionType[],
): Promise<{ userId: string; actions: ModAction[] }[]> {
	try {
		const hasType = types?.length
			? or(...types.map((type) => sql`${userProfileTable.moderation} @> ${JSON.stringify([{ type }])}::jsonb`))
			: undefined;

		const rows = await db
			.select({ userId: userProfileTable.discordId, actions: userProfileTable.moderation })
			.from(userProfileTable)
			.where(and(
				eq(userProfileTable.serverId, serverId),
				sql`jsonb_array_length(${userProfileTable.moderation}) > 0`,
				hasType,
			));

		return rows;
	} catch (error) {
		console.error("Error getting mod profiles:", error);
		return [];
	}
}

/**
 * Puts the actions of many users into one list, newest first
 */
export function FlattenActions(
	profiles: { userId: string; actions: ModAction[] }[],
): ServerAction[] {
	const all: ServerAction[] = [];

	for (const profile of profiles) {
		profile.actions.forEach((action, index) => {
			all.push({ userId: profile.userId, number: index + 1, action });
		});
	}

	return all.sort((a, b) => b.action.at - a.action.at);
}

/**
 * The last mute or unmute that isnt voided, that decides if they are muted
 */
function LastState(profile: HasModeration, start: "mute" | "softban"): NumberedAction | null {
	const end = start === "mute" ? "unmute" : "unban";
	const actions = profile?.moderation ?? [];

	for (let i = actions.length - 1; i >= 0; i--) {
		const action = actions[i];
		if (action.voided) continue;
		if (action.type === start || action.type === end) return { number: i + 1, action };
	}

	return null;
}

function IsActive(state: NumberedAction | null, start: "mute" | "softban"): state is NumberedAction {
	if (!state || state.action.type !== start) return false;
	return state.action.until == null || state.action.until > Date.now();
}

/**
 * The mute they currently have, null if they arent muted
 */
export function GetActiveMute(profile: HasModeration): NumberedAction | null {
	const state = LastState(profile, "mute");
	return IsActive(state, "mute") ? state : null;
}

/**
 * The softban they currently have, null if they arent banned
 */
export function GetActiveBan(profile: HasModeration): NumberedAction | null {
	const state = LastState(profile, "softban");
	return IsActive(state, "softban") ? state : null;
}

/**
 * When the last mute ends, used to refresh long mutes
 * @returns Infinity if it never ends, 0 if they got unmuted, null if they have no mute record
 */
export function GetMuteExpiry(profile: HasModeration): number | null {
	const state = LastState(profile, "mute");
	if (!state) return null;
	if (state.action.type === "unmute") return 0;
	return state.action.until ?? Infinity;
}

/**
 * Turns the old timeout/banned/banreason/banduration columns into actions, used when moving the old data over
 */
export function LegacyToActions(
	old: {
		timeout?: number | null;
		banned?: boolean | null;
		banreason?: string | null;
		banduration?: string | null;
	},
	now = Date.now(),
): ModAction[] {
	const actions: ModAction[] = [];

	// we dont know when or who did the old ones
	if (old.banduration || old.banreason) {
		const until = parseInt(old.banduration ?? "", 10);
		actions.push({
			type: "softban",
			at: now,
			by: null,
			reason: `${old.banreason ?? "No reason saved"} (migrated)`,
			until: Number.isNaN(until) ? null : until,
		});
	}

	if (old.timeout && old.timeout > now) {
		actions.push({
			type: "mute",
			at: now,
			by: null,
			reason: "(Migrated)",
			until: old.timeout,
		});
	}

	return actions;
}
