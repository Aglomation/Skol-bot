import type { Guild } from "discord.js";

export const getDisplayName = (guild: Guild | null, userId: string, slice: number = Infinity): string | undefined => {
    const member = guild?.members.cache.get(userId);
    const name = member?.nickname || member?.displayName || member?.user.displayName || member?.user.username || undefined;

    return name?.slice(0, slice);
};