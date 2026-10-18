import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { userProfileTable } from "../db/schema.js";

export type UserProfile = typeof userProfileTable.$inferSelect;
export type UserProfileKey = keyof UserProfile;

// What UpdateProfile returns, null means it saved
export const PROFILE_DUPLICATE = 1; // a unique value (email or verify code) is already used by someone else
export const PROFILE_FAILED = 2; // something else went wrong, it is in the console

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
                ...newData 
            })
            .onConflictDoUpdate({
                target: [userProfileTable.discordId, userProfileTable.serverId],
                set: newData
            });
    } catch (err: unknown) {
		if (err instanceof Error) {
            const pgError = err as Error & { code?: string };
            
            // Postgres error code 23505 means "unique_violation"
            if (pgError.code === '23505' || pgError.message.includes("unique constraint")) {
                console.warn("Unique constraint violation in UpdateProfile.");
                return PROFILE_DUPLICATE;
            }
        }

        console.error("Error upserting profile:", err);
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
		console.error("Error getting profile:", error);
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
		console.error("Error finding user by value:", error);
		return null;
	}
}

/**
 * Find all users by a specific profile field
 * @param key The profile field to search by
 * @param value The value to search for
 * @returns An array of user profiles matching the search
 */
export async function FindAllByValue(
	key: UserProfileKey,
	value: string | null,
): Promise<UserProfile[]> {
	try {
		const query = db.select().from(userProfileTable);
		const result = await (value === null
			? query.where(isNull(userProfileTable[key]))
			: query.where(eq(userProfileTable[key], value)));
		return result.length > 0 ? result : [];
	} catch (error) {
		console.error("Error finding user by value:", error);
		return [];
	}
}

/**
 * Find all users by a specific profile field
 * @param key The profile field to search by
 * @param value The value to search for
 * @returns An array of user profiles matching the search criteria
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
		console.error("Error finding all non-null keys:", error);
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
 * Remove a profile completely, including the moderation history
 * Throws if the database fails
 */
export async function DeleteProfile(userId: string, serverId: string): Promise<void> {
		await db.delete(userProfileTable)
			.where(and(eq(userProfileTable.discordId, userId), eq(userProfileTable.serverId, serverId)));
}
