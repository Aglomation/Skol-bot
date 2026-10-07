import { eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { serverConfigTable } from "../db/schema.js";

export type ServerConfig = typeof serverConfigTable.$inferSelect;
export type ServerConfigKey = keyof ServerConfig;

// Cache so we dont hit the database on every message/voice update
// Everything that changes the config goes through here so the cache updates itself
// The time is only a backup for when someone edits the database directly
const CACHE_TIME = 60 * 60 * 1000;
const MISSING_CACHE_TIME = 30 * 1000;

type CacheEntry = { config: ServerConfig | null; expires: number };
const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<ServerConfig | null>>();

function SaveToCache(id: string, config: ServerConfig | null): void {
	cache.set(id, {
		config,
		expires: Date.now() + (config ? CACHE_TIME : MISSING_CACHE_TIME),
	});
}

/**
 * Clear the cached config
 * @param id The server to clear, leave empty to clear all of them
 */
export function ClearServerConfigCache(id?: string): void {
	if (id === undefined) {
		cache.clear();
		pending.clear();
		return;
	}
	cache.delete(id);
	pending.delete(id);
}

/**
 * Update a server config, if not exist make one
 */
export async function UpdateServerConfig(
	id: string,
	newData: Partial<ServerConfig>,
): Promise<void> {
	try {
		const [row] = await db.insert(serverConfigTable)
			.values({
				id,
				...newData
			})
			.onConflictDoUpdate({
				target: [serverConfigTable.id],
				set: newData
			})
			.returning();

		// put the new config in the cache
		if (row) SaveToCache(id, row);
		else ClearServerConfigCache(id);
	} catch (err: unknown) {
		ClearServerConfigCache(id);
		console.error("Error upserting server config:", err);
	}
}

/**
 * Get a single server config
 * @param id The ID of the server config to retrieve
 * @param force Skip the cache and get the latest from the database
 * @returns The server config object, or null if not found
 */
export async function GetFullServerConfig(id: string, force = false): Promise<ServerConfig | null> {
	const cached = cache.get(id);
	if (!force && cached && cached.expires > Date.now()) {
		return cached.config ? { ...cached.config } : null;
	}

	// if its already being fetched, wait for that one instead of sending another
	let request = pending.get(id);
	if (!request || force) {
		request = (async () => {
			try {
				const result = await db
					.select()
					.from(serverConfigTable)
					.where(eq(serverConfigTable.id, id))
					.limit(1);
				const config = result.length > 0 ? result[0] : null;
				SaveToCache(id, config);
				return config;
			} catch (error) {
				console.error("Error getting server config:", error);
				// old config is better than no config
				return cached?.config ?? null;
			} finally {
				pending.delete(id);
			}
		})();
		pending.set(id, request);
	}

	const config = await request;
	return config ? { ...config } : null;
}

/**
 * Get one value from a server config
 * @param force Skip the cache and get the latest from the database
 */
export async function GetServerConfig(id: string, key: ServerConfigKey, force = false): Promise<string | number | boolean | null> {
	try {
		const serverConfig = await GetFullServerConfig(id, force);
		if (!serverConfig) {
			console.error(`Server config not found for ID: ${id}`);
			return null;
		}
		return serverConfig[key] ?? null;
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
export async function FindAllNonNullKeysConfig(
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
		ClearServerConfigCache(id);
	} catch (error) {
		console.error("Error deleting server config:", error);
	}
}
