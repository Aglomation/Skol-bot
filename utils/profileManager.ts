import { neon } from "@neondatabase/serverless";
import { eq, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { userProfileTable } from "../db/schema.js";

const sql = neon(process.env.DATABASE_URL || "");
const db = drizzle({ client: sql });

type UserProfile = typeof userProfileTable.$inferSelect;
type UserProfileKey = keyof UserProfile;


/**
 * Update partial data in a user's profile
 */
export async function UpdateProfile(
    userId: string,
    newData: Partial<UserProfile>,
): Promise<void> {
    try {
        await db
            .update(userProfileTable)
            .set(newData)
            .where(eq(userProfileTable.id, userId));
    } catch (err) {
        console.error("Error updating profile value1:", err);
    }
}

export async function FindByEmail(email: string): Promise<UserProfile | null> {
    try {
        const result = await db
            .select()
            .from(userProfileTable)
            .where(eq(userProfileTable.email, email))
            .limit(1);
        return result.length > 0 ? result[0] : null;
    } catch (error) {
        console.error("Error finding user by email:", error);
        return null;
    }
}

/**
 * Find all users with birthday set
 * @return An array of user profiles with birthday set
 */
export async function GetAllWithBirthday(): Promise<UserProfile[]> {
    try {
        const results = await db.select().from(userProfileTable).where(isNotNull(userProfileTable.birthday));
        return results;
    } catch (error) {
        console.error("Error finding all key users:", error);
        return [];
    }
};

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
    }
    catch (error) {
        console.error("Error getting profile:", error);
        return null;
    }
};

/**
 * Remove a profile
 */
export async function DeleteProfile(userId: string): Promise<void> {
    try {
        await db
            .delete(userProfileTable)
            .where(eq(userProfileTable.id, userId));
    } catch (error) {
        console.error("Error deleting profile:", error);
    }
};
