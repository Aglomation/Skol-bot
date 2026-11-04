import type { Guild } from "discord.js";

/**
 * Gets the most relevant display name for a user in a guild.
 */
export const GetDisplayName = (
    guild: Guild | null,
    userId: string | undefined,
    maxLength?: number
): string | undefined => {
    if (!guild || !userId) return undefined;
    const member = guild?.members.cache.get(userId);

    const name = member?.displayName || member?.user.username;

    if (!name) return undefined;
    return maxLength ? name.slice(0, maxLength) : name;
};
