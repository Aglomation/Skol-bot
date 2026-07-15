import type { Guild } from "discord.js";

/**
 * Gets the most relevant display name for a user in a guild.
 */
export const getDisplayName = (
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

/**
 * Counts members who have a primary role, and optionally filters by secondary roles.
 */
export const getRoleUserCount = (
    guild: Guild | null, 
    primaryRole: string, 
    needOneSecondary: boolean = false, 
    secondaryRoles?: string[]
): number => {
    if (!guild) return 0;

    const primaryRoleObj = guild.roles.cache.get(primaryRole);
    if (!primaryRoleObj) return 0;  

    if (!secondaryRoles || secondaryRoles.length === 0) {
        return primaryRoleObj.members.size;
    }
    
    const count = primaryRoleObj.members.filter(member => {
        if (needOneSecondary) {
            // Member needs AT LEAST ONE of the secondary roles
            return secondaryRoles.some((roleId) => member.roles.cache.has(roleId));
        } else {
            // Member needs ALL of the secondary roles
            return secondaryRoles.every((roleId) => member.roles.cache.has(roleId));
        }
    }).size;

    return count;
};