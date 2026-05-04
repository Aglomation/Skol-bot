import fs from 'fs';

const PROFILE_FILE = "./storage/profiles.json";

export type ProfileList = Record<string, UserProfile>;

/**
 * Load all profiles from the JSON file
 */
export const loadProfileList = (): ProfileList => {
    try {
        if (!fs.existsSync(PROFILE_FILE)) {
            if (!fs.existsSync("./storage")) fs.mkdirSync("./storage");
            return {};
        }
        const data = fs.readFileSync(PROFILE_FILE, 'utf-8');
        return JSON.parse(data) as ProfileList;
    } catch (error) {
        console.error("Error loading profiles:", error);
        return {};
    }
};

/**
 * Save the entire profile list to the JSON file
 */
export const saveProfileList = (profiles: ProfileList): void => {
    try {
        fs.writeFileSync(PROFILE_FILE, JSON.stringify(profiles, null, 4));
    } catch (error) {
        console.error("Error saving profiles:", error);
    }
};

/**
 * Update a specific key within a user's profile
 */
export const updateProfileValue = <K extends keyof UserProfile>(
    userId: string,
    key: K,
    value: UserProfile[K]
): void => {
    const profiles = loadProfileList();
    
    if (!profiles[userId]) {    
        profiles[userId] = {} as UserProfile;
    }
    profiles[userId][key] = value;
    saveProfileList(profiles);
};

/**
 * Comprehensive Search: Find a user by any property
 * @param key The profile property to search by (e.g., "email", "birthday")
 * @param value The value to match for the specified property
 * @returns The user ID of the first matching profile, or null if no match is found
 */
export const findUserByValue = <K extends keyof UserProfile>(
    key: K,
    value: UserProfile[K]
): string | null => {
    const profiles = loadProfileList();
    return Object.keys(profiles).find(id => profiles[id][key] === value) || null;
};

/**
 * Find all users by a specific value
 * @param key The profile property to search by (e.g. "birthday")
 * @param value The value to match for the specified property
 * @returns An array of user IDs matching the specified value
 */
export const findAllUsersByValue = <K extends keyof UserProfile>(
    key: K,
    value: UserProfile[K]
): UserProfile[] => {
    const profiles = loadProfileList();
    return Object.keys(profiles).filter(id => profiles[id][key] === value).map(id => profiles[id]);
};

/**
 * Find all users for a specific key
 * @param key The profile property to search by (e.g. "birthday")
 * @returns An array of objects containing user IDs and their corresponding values for the specified key
 */
export const findAllKeyUsers = <K extends keyof UserProfile>(
    key: K
): { userId: string; value: UserProfile[K] }[] => {
    const profiles = loadProfileList();
    return Object.keys(profiles).filter(userId => profiles[userId][key] !== undefined).map(userId => ({
        userId,
        value: profiles[userId][key]
    }));
};

/**
 * Get a single profile
 * @param userId The ID of the user whose profile to retrieve
 * @returns The user's profile object, or null if not found
 */
export const getProfile = (userId: string): UserProfile | null => {
    const profiles = loadProfileList();
    return profiles[userId] || null;
};

/**
 * Get a specific value from a user's profile
 * @param userId The ID of the user whose value you want to get
 * @param key The key for said value
 * @returns The value of the specified key for the user, or null if not found
 */
export const getValue = <K extends keyof UserProfile>(
    userId: string,
    key: K
): UserProfile[K] | null => {
    const profiles = loadProfileList();

    const user = profiles[userId];
    if (!user) {
        return null;
    }

    const value = user[key];
    if (value === undefined) {
        return null;
    }

    return value;
};


/**
 * Remove a profile
 */
export const deleteProfile = (userId: string): void => {
    const profiles = loadProfileList();
    if (profiles[userId]) {
        delete profiles[userId];
        saveProfileList(profiles);
    }
};