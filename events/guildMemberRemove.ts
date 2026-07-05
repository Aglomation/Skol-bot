import type { Client, GuildMember } from "discord.js";
import { Events } from "discord.js";

import { DeleteProfile, getValueByKey, UpdateProfile } from "../utils/profileManager.js";

export default {
	name: Events.GuildMemberRemove,
	once: false,
	async execute(member: GuildMember, _client: Client) {
        const preference = await getValueByKey(member.id, "privacyOption") || 2;

        if (preference === 3) {
            // Delete all data for this user
            await DeleteProfile(member.id);
            console.log(`Deleted all data for user ${member.user.tag} (${member.id}) due to privacy preference.`);
        }

        if (preference === 2) {
            // Delete optionally added data, we dont really save anything so this is literally only birthday
            await UpdateProfile(member.id, {
                birthday: null,
            });
            console.log(`Deleted optionally added data for user ${member.user.tag} (${member.id}) due to privacy preference.`);
        }

        if (preference === 1) {
            console.log(`Kept all data for user ${member.user.tag} (${member.id}) due to privacy preference.`);
        }
	},
};
