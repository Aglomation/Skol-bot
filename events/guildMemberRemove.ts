import type { Client, GuildMember } from "discord.js";
import { Events } from "discord.js";

import { DeleteProfile, getValueByKey, UpdateProfile } from "../utils/profileManager.js";

const PRIVACY_PREFERENCE = {
    KEEP_ALL: 1,
    DELETE_OPTIONAL: 2, // Default
    DELETE_ALL: 3,
};

export default {
	name: Events.GuildMemberRemove,
	once: false,
	async execute(member: GuildMember, _client: Client) {
        const preference = await getValueByKey(member.id, "privacyOption") || 2;

        switch (preference) {
            case PRIVACY_PREFERENCE.DELETE_ALL:
                await DeleteProfile(member.id);
                console.log(`Deleted all data for user ${member.user.tag} (${member.id}) due to privacy preference.`);
                break;

            case PRIVACY_PREFERENCE.DELETE_OPTIONAL:
                // Delete optionally added data (currently only birthday)
                await UpdateProfile(member.id, { birthday: null });
                console.log(`Deleted optionally added data for user ${member.user.tag} (${member.id}) due to privacy preference.`);
                break;

            case PRIVACY_PREFERENCE.KEEP_ALL:
                console.log(`Kept all data for user ${member.user.tag} (${member.id}) due to privacy preference.`);
                break;

            default:
                console.log(`Unknown privacy preference (${preference}) for user ${member.user.tag}. Doing nothing.`);
                break;
        }
	},
};
