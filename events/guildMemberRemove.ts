import type { GuildMember, PartialGuildMember } from "discord.js";
import { Events } from "discord.js";

import { PRIVACY_PREFERENCE } from "../db/schema.js";
import { DeletePersonalData, GetProfile, UpdateProfile } from "../utils/profileManager.js";

export default {
    name: Events.GuildMemberRemove,
    once: false,
    async execute(member: GuildMember | PartialGuildMember) {
        const profile = await GetProfile(member.id, member.guild.id);

        // we never saved anything about them, UpdateProfile would only make an empty profile
        if (!profile) return;

        const preference = profile.privacyOption || PRIVACY_PREFERENCE.DELETE_OPTIONAL;

        switch (preference) {
            case PRIVACY_PREFERENCE.DELETE_ALL:
                // moderation history is kept as the privacy policy allows
                await DeletePersonalData(member.id, member.guild.id);
                console.log("A member left, all of their data was deleted as they chose.");
                break;

            case PRIVACY_PREFERENCE.DELETE_OPTIONAL:
                // Delete optionally added data (currently only birthday)
                if (profile.birthday !== null) {
                await UpdateProfile(member.id, member.guild.id, { birthday: null });
                    console.log(`Deleted optionally added data for user ${member.id} due to privacy preference.`);
                }
                break;

            case PRIVACY_PREFERENCE.KEEP_ALL:
                console.log("A member left, their data was kept as they chose.");
                break;

            default:
                console.log(`Unknown privacy preference (${preference}) on a member that left. Doing nothing.`);
                break;
        }
    },
};
