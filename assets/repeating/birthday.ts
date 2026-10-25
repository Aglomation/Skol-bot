import type { Client, Guild, TextChannel } from "discord.js";
import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { HIDDEN_YEAR, IsBirthdayOn, TodayInSweden } from "../../utils/birthdayUtils.js";
import { FindAllNonNullKeysConfig, GetServerConfig } from "../../utils/configManager.js";
import { GetDisplayName } from "../../utils/memberUtils.js";
import { FindAllNonNullKeys } from "../../utils/profileManager.js";


const formatBirthdayLine = (
    guild: Guild | null, 
    member: UserProfile, 
    currentYear: number
): string => {
    const name = GetDisplayName(guild, member.discordId);
    const mention = `(<@${member.discordId}>)`; 

    // birthdays are saved as midnight UTC
    const birthdayDate = new Date((member.birthday as number) * 1000);
    if (birthdayDate.getUTCFullYear() === HIDDEN_YEAR) return `${name} ${mention}`;

    return `${name} ${mention} - ${currentYear - birthdayDate.getUTCFullYear()} Years old`;
};

// "server:user:month-day" of everyone that already got their message today, so setting a birthday on the day itself can't post it twice
const announced = new Set<string>();

/**
 * Sends the happy birthday message for these members in the birthday channel of the server
 * Anyone who already got one today is skipped
 */
export async function AnnounceBirthdays(client: Client, guild: Guild, members: UserProfile[]): Promise<void> {
    const today = TodayInSweden();
    const day = `${today.month}-${today.day}`;

    // forget the ones from earlier days
    for (const key of announced) {
        if (!key.endsWith(`:${day}`)) announced.delete(key);
    }

    const channelId = await GetServerConfig(guild.id, "birthdayChannel");
    const birthdayChannel = channelId ? client.channels.cache.get(channelId) as TextChannel | undefined : undefined;
    if (!client.user || !birthdayChannel?.permissionsFor(client.user)?.has(PermissionFlagsBits.SendMessages)) return;

    const todaysBirthdays = members.filter((member) => !announced.has(`${guild.id}:${member.discordId}:${day}`));
    if (todaysBirthdays.length === 0) return;

    todaysBirthdays.sort((a, b) => {
        const yearA = new Date((a.birthday as number) * 1000)?.getUTCFullYear() || 0;
        const yearB = new Date((b.birthday as number) * 1000)?.getUTCFullYear() || 0;
        return yearB - yearA; 
    });

    const descriptionLines = todaysBirthdays.map(member => 
        formatBirthdayLine(guild, member, today.year)
    );

    const embed = new EmbedBuilder()
        .setTitle("🎉 Happy Birthday! 🎉")
        .setDescription(descriptionLines.join("\n"))
        .setFooter({ text: "Use /birthday set to set your birthday!" })
        .setColor(0xff0000);

    const response = await birthdayChannel.send({
        embeds: [embed],
        allowedMentions: { users: [] },
    });

    for (const member of todaysBirthdays) announced.add(`${guild.id}:${member.discordId}:${day}`);

    response.react("🎉").catch(() => null);
}

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
