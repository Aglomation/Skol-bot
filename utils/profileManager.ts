import { neon } from "@neondatabase/serverless";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { userProfileTable } from "../db/schema.js";

const sql = neon(process.env.DATABASE_URL || "");
const db = drizzle({ client: sql });

export type UserProfile = typeof userProfileTable.$inferSelect;
export type UserProfileKey = keyof UserProfile;

/**
 * Update a user's profile, if not exist make one
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
                return 1;
            }
        }

        console.error("Error upserting profile:", err);
    }
    return null;
}

/**
 * Get a single profile
 * @param userId The ID of the user whose profile to retrieve
 * @returns The user's profile object, or null if not found
 */
export async function GetProfile(userId: string, serverId: string): Promise<UserProfile | null> {
	try {
		const result = await db
			.select()
			.from(userProfileTable)
			.where(and(eq(userProfileTable.discordId, userId), eq(userProfileTable.serverId, serverId)))
			.limit(1);
		return result.length > 0 ? result[0] : null;
	} catch (error) {
		console.error("Error getting profile:", error);
		return null;
	}
}

export async function getValueByKey(userId: string, serverId: string, key: UserProfileKey): Promise<string | number | boolean | null> {
	try {
		const profile = await GetProfile(userId, serverId);
		if (!profile) {
			console.error(`Profile not found for user ID: ${userId}`);
			return null;
		}
		return profile[key] ?? null;
	} catch (error) {
		console.error("Error getting value by key:", error);
		return null;
	}
}

/**
 * Find a user by a specific profile field
 * @param key The profile field to search by
 * @param value The value to search for
 * @returns The user profile matching the search
 */
export async function FindByValue(
	key: UserProfileKey,
	value: string | null,
): Promise<UserProfile | null> {
	try {
		const query = db.select().from(userProfileTable).limit(1);
		const result = await (value === null
			? query.where(isNull(userProfileTable[key]))
			: query.where(eq(userProfileTable[key], value)));
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
 * Remove a profile
 */
export async function DeleteProfile(userId: string, serverId: string): Promise<void> {
	try {
		await db.delete(userProfileTable)
			.where(and(eq(userProfileTable.discordId, userId), eq(userProfileTable.serverId, serverId)));
	} catch (error) {
		console.error("Error deleting profile:", error);
	}
}
