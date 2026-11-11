import type { Client } from "discord.js";
import { AnnounceBirthdays, IsBirthdayOn, TodayInSweden } from "../../features/birthdays.js";
import { FindAllNonNullKeysConfig } from "../../utils/configManager.js";
import { FindAllNonNullKeys } from "../../utils/profileManager.js";

const repeating: Repeating = {
    data: {
        immediate: false,
        repeating: true,
        time: null,
        clockTime: "00:00",
    },
    async execute(client: Client) {
        const today = TodayInSweden();
        const servers = await FindAllNonNullKeysConfig("birthdayChannel");

        for (const server of servers){
            const guild = client.guilds.cache.get(server.id);
            if (!guild) continue;

            // one server failing must not stop the others from getting their messages
            try {
                const birthdayMembers = await FindAllNonNullKeys("birthday", server.id);

                const todaysBirthdays: UserProfile[] = [];
                for (const member of birthdayMembers) {
                    const birthday = member.birthday as UserProfile["birthday"] | null;
                    if (birthday == null) continue;

                    const date = new Date(birthday * 1000);
                    if (!IsBirthdayOn({ month: date.getUTCMonth() + 1, day: date.getUTCDate() }, today)) continue;

                    // the member isn't always in the cache, and the name is taken from it
                    const inServer = await guild.members.fetch(member.discordId).catch(() => null);
                    if (inServer) todaysBirthdays.push(member);
                }

                await AnnounceBirthdays(client, guild, todaysBirthdays);
            } catch (error) {
                console.error(`Could not announce the birthdays in ${guild.id}:`, error);
            }
        }
    },
};

export default repeating;
