import { neon } from "@neondatabase/serverless";
import { eq, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { userProfileTable } from "../db/schema.js";

const sql = neon(process.env.DATABASE_URL || "");
const db = drizzle({ client: sql });

export type UserProfile = typeof userProfileTable.$inferSelect;
export type UserProfileKey = keyof UserProfile;

/**
 * Update partial data in a user's profile
 */
export async function UpdateProfile(
	userId: string,
	newData: Partial<UserProfile>,
): Promise<void> {
	try {
		if ((await GetProfile(userId)) === null) {
			await CreateProfile(userId, newData);
			return;
		}
		await db
			.update(userProfileTable)
			.set(newData)
			.where(eq(userProfileTable.id, userId));
	} catch (err) {
		console.error("Error updating profile value1:", err);
	}
}

/**
 * Create a user's profile
 */
export async function CreateProfile(
	userId: string,
	newData: Partial<UserProfile>,
): Promise<void> {
	try {
		await db.insert(userProfileTable).values({ ...newData, id: userId });
	} catch (err) {
		console.error("Error creating profile:", err);
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
		const result = await db
			.select()
			.from(userProfileTable)
			.where(eq(userProfileTable[key], value))
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
		const result = await db
			.select()
			.from(userProfileTable)
			.where(eq(userProfileTable[key], value));
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
): Promise<UserProfile[]> {
	try {
		const result = await db
			.select()
			.from(userProfileTable)
			.where(isNotNull(userProfileTable[key]));
		return result.length > 0 ? result : [];
	} catch (error) {
		console.error("Error finding all non-null keys:", error);
		return [];
	}
}

/**
 * Get a single profile
 * @param userId The ID of the user whose profile to retrieve
 * @returns The user's profile object, or null if not found
 */
export async function GetProfile(userId: string): Promise<UserProfile | null> {
	try {
		const result = await db
			.select()
			.from(userProfileTable)
			.where(eq(userProfileTable.id, userId))
			.limit(1);
		return result.length > 0 ? result[0] : null;
	} catch (error) {
		console.error("Error getting profile:", error);
		return null;
	}
}

/**
 * Remove a profile
 */
export async function DeleteProfile(userId: string): Promise<void> {
	try {
		await db.delete(userProfileTable).where(eq(userProfileTable.id, userId));
	} catch (error) {
		console.error("Error deleting profile:", error);
	}
}
