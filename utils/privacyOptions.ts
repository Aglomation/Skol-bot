// What happens to the data of a member when they leave, saved in user_profiles.privacyOption
export const PRIVACY_PREFERENCE = {
	KEEP_ALL: 1,
	DELETE_OPTIONAL: 2, // Default
	DELETE_ALL: 3,
} as const;
