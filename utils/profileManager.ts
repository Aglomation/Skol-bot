import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { serverConfigTable, userProfileTable } from "../db/schema.js";
import { SafeError } from "./errorText.js";

// What UpdateProfile returns, null means it saved
export const PROFILE_DUPLICATE = 1; // a unique value (email or verify code) is already used by someone else
export const PROFILE_FAILED = 2; // something else went wrong, it is in the console

/**
 * Postgres says 23505 for a unique violation, drizzle wraps that error in its own so the code is on the cause
 */
function IsUniqueViolation(error: unknown): boolean {
	for (let current = error, depth = 0; current instanceof Error && depth < 5; depth++) {
		if ((current as Error & { code?: string }).code === "23505") return true;
		current = current.cause;
	}
	return false;
}

/**
 * Update a user's profile, if not exist make one
 * @returns null if it saved, otherwise PROFILE_DUPLICATE or PROFILE_FAILED
 */
export async function UpdateProfile(
	discordId: string,
	serverId: string,
	newData: Partial<UserProfile>,
): Promise<number | null> {
	try {
		await db.insert(userProfileTable)
			.values({
				discordId,
				serverId,
				...newData,
			})
			.onConflictDoUpdate({
				target: [userProfileTable.discordId, userProfileTable.serverId],
				set: newData,
			});
	} catch (err: unknown) {
		if (IsUniqueViolation(err)) {
			console.warn("Unique constraint violation in UpdateProfile.");
			return PROFILE_DUPLICATE;
		}

		console.error("Error upserting profile:", SafeError(err));
		return PROFILE_FAILED;
	}
	return null;
}

/**
 * Get a single profile, throws if the database fails
 * Use this when a database that is down must not look the same as a user without a profile (like the ban list)
 * @returns The user's profile object, or null if they don't have one
 */
export async function GetProfileStrict(userId: string, serverId: string): Promise<UserProfile | null> {
	const result = await db
		.select()
		.from(userProfileTable)
		.where(and(eq(userProfileTable.discordId, userId), eq(userProfileTable.serverId, serverId)))
		.limit(1);
	return result.length > 0 ? result[0] : null;
}

/**
 * Get a single profile
 * @param userId The ID of the user whose profile to retrieve
 * @returns The user's profile object, or null if not found (also when the database fails, it is in the console)
 */
export async function GetProfile(userId: string, serverId: string): Promise<UserProfile | null> {
	try {
		return await GetProfileStrict(userId, serverId);
	} catch (error) {
		console.error("Error getting profile:", SafeError(error));
		return null;
	}
}

/**
 * Find a user by a specific profile field
 * @param key The profile field to search by
 * @param value The value to search for
 * @param serverId Only look in this server, leave empty to look in all of them
 * @returns The user profile matching the search
 */
export async function FindByValue(
	key: UserProfileKey,
	value: string | null,
	serverId?: string,
): Promise<UserProfile | null> {
	try {
		const condition = value === null
			? isNull(userProfileTable[key])
			: eq(userProfileTable[key], value);
		const result = await db
			.select()
			.from(userProfileTable)
			.where(serverId ? and(condition, eq(userProfileTable.serverId, serverId)) : condition)
			.limit(1);
		return result.length > 0 ? result[0] : null;
	} catch (error) {
		console.error("Error finding user by value:", SafeError(error));
		return null;
	}
}

/**
 * Find all users that have a value in a specific profile field
 * @param key The profile field to look at
 * @param serverId Only look in this server, leave empty to look in all of them
 * @returns An array of user profiles that have a value there
 */
export async function FindAllNonNullKeys(
	key: UserProfileKey,
	serverId?: string,
): Promise<UserProfile[]> {
	try {
		const result = await db
			.select()
			.from(userProfileTable)
			.where(
				serverId
					? and(isNotNull(userProfileTable[key]), eq(userProfileTable.serverId, serverId))
					: isNotNull(userProfileTable[key]),
			);
		return result.length > 0 ? result : [];
	} catch (error) {
		console.error("Error finding all non-null keys:", SafeError(error));
		return [];
	}
}

/**
 * Deletes a users personal data (email, verify code, birthday)
 * The moderation history is kept as the privacy policy allows, so the row stays if there is any
 * Profiles without moderation history are deleted completely
 * Throws if the database fails, so nobody is told their data is gone when it isnt
 * @returns true if the moderation history was kept
 */
export async function DeletePersonalData(userId: string, serverId: string): Promise<boolean> {
	const isTheirs = and(eq(userProfileTable.discordId, userId), eq(userProfileTable.serverId, serverId));

	// one query that only deletes a profile with an empty history, so a case that is added at the same moment can't be deleted with it
	const deleted = await db.delete(userProfileTable)
		.where(and(isTheirs, sql`jsonb_array_length(${userProfileTable.moderation}) = 0`))
		.returning({ id: userProfileTable.id });
	if (deleted.length > 0) return false;

	// there is a history (or no profile at all), the row stays and only the personal data goes
	const kept = await db.update(userProfileTable)
		.set({ email: null, verifycode: null, birthday: null })
		.where(isTheirs)
		.returning({ id: userProfileTable.id });
	return kept.length > 0;
}

/**
 * Every profile of a server, for the sweep that looks for members that left
 */
export async function FindAllProfiles(serverId: string): Promise<UserProfile[]> {
	return await db.select().from(userProfileTable).where(eq(userProfileTable.serverId, serverId));
}

/**
 * The ids of all servers that have data saved, it is compared to the servers the bot is in
 */
export async function ListStoredServerIds(): Promise<string[]> {
	const profiles = await db.selectDistinct({ serverId: userProfileTable.serverId }).from(userProfileTable);
	const configs = await db.select({ id: serverConfigTable.id }).from(serverConfigTable);
	return [...new Set([...profiles.map((row) => row.serverId), ...configs.map((row) => row.id)])];
}

/**
 * Deletes every profile of a server, including the moderation history, used when the bot has been removed from it for good
 * @returns How many profiles were deleted
 */
export async function DeleteServerProfiles(serverId: string): Promise<number> {
	const deleted = await db.delete(userProfileTable).where(eq(userProfileTable.serverId, serverId)).returning({ id: userProfileTable.id });
	return deleted.length;
}
