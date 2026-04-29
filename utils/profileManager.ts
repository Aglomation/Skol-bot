import fs from 'fs';

const PROFILE_FILE = "./storage/profiles.json";

// Define the shape of the full JSON object
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
 * Usage: updateProfileValue("12345", "verifycode", 5544)
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
 * Usage: findUserByValue("verifycode", 1234)
 */
export const findUserByValue = <K extends keyof UserProfile>(
    key: K,
    value: UserProfile[K]
): string | null => {
    const profiles = loadProfileList();
    return Object.keys(profiles).find(id => profiles[id][key] === value) || null;
};

/**
 * Get a single profile
 */
export const getProfile = (userId: string): UserProfile | null => {
    const profiles = loadProfileList();
    return profiles[userId] || null;
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