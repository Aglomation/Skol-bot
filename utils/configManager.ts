import { neon } from "@neondatabase/serverless";
import { eq, isNotNull, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { serverConfigTable } from "../db/schema.js";

const sql = neon(process.env.DATABASE_URL || "");
const db = drizzle({ client: sql });

export type ServerConfig = typeof serverConfigTable.$inferSelect;
export type ServerConfigKey = keyof ServerConfig;

/**
 * Update a server config, if not exist make one
 */
export async function UpdateServerConfig(
    id: string,
    newData: Partial<ServerConfig>,
): Promise<void> {
    try {
        await db.insert(serverConfigTable)
            .values({
                id,
                ...newData 
            })
            .onConflictDoUpdate({
                target: [serverConfigTable.id],
                set: newData
            });
    } catch (err: unknown) {
        console.error("Error upserting server config:", err);
    }
}

/**
 * Get a single server config
 * @param id The ID of the server config to retrieve
 * @returns The server config object, or null if not found
 */
export async function GetFullServerConfig(id: string): Promise<ServerConfig | null> {
	try {
		const result = await db
			.select()
			.from(serverConfigTable)
			.where(eq(serverConfigTable.id, id))
			.limit(1);
		return result.length > 0 ? result[0] : null;
	} catch (error) {
		console.error("Error getting server config:", error);
		return null;
	}
}

export async function GetServerConfig(id: string, key: ServerConfigKey): Promise<string | number | boolean | null> {
	try {
		const profile = await GetFullServerConfig(id);
		if (!profile) {
			console.error(`Server config not found for ID: ${id}`);
			return null;
		}
		return profile[key] ?? null;
	} catch (error) {
		console.error("Error getting value by key:", error);
		return null;
	}
}

/**
 * Find a server config by a specific field
 * @param key The server config field to search by
 * @param value The value to search for
 * @returns The server config matching the search
 */
export async function FindByValue(
	key: ServerConfigKey,
	value: string | null,
): Promise<ServerConfig | null> {
	try {
		const query = db.select().from(serverConfigTable).limit(1);
		const result = await (value === null
			? query.where(isNull(serverConfigTable[key]))
			: query.where(eq(serverConfigTable[key], value)));
		return result.length > 0 ? result[0] : null;
	} catch (error) {
		console.error("Error finding server config by value:", error);
		return null;
	}
}

/**
 * Find all server configs by a specific field
 * @param key The field to search by
 * @param value The value to search for
 * @returns An array of server configs matching the search
 */
export async function FindAllByValue(
	key: ServerConfigKey,
	value: string | null,
): Promise<ServerConfig[]> {
	try {
		const query = db.select().from(serverConfigTable);
		const result = await (value === null
			? query.where(isNull(serverConfigTable[key]))
			: query.where(eq(serverConfigTable[key], value)));
		return result.length > 0 ? result : [];
	} catch (error) {
		console.error("Error finding server config by value:", error);
		return [];
	}
}

/**
 * Find all server configs by a specific field
 * @param key The field to search by
 * @param value The value to search for
 * @returns An array of server configs matching the search criteria
 */
export async function FindAllNonNullKeys(
	key: ServerConfigKey,
): Promise<ServerConfig[]> {
	try {
		const result = await db
			.select()
			.from(serverConfigTable)
			.where(isNotNull(serverConfigTable[key]));
		return result.length > 0 ? result : [];
	} catch (error) {
		console.error("Error finding all non-null keys:", error);
		return [];
	}
}

/**
 * Remove a server config
 */
export async function DeleteServerConfig(id: string): Promise<void> {
	try {
		await db.delete(serverConfigTable).where(eq(serverConfigTable.id, id));
	} catch (error) {
		console.error("Error deleting server config:", error);
	}
}
