import type { Client, Guild, TextChannel } from "discord.js";
import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { FindAllNonNullKeysConfig, GetServerConfig } from "../../utils/configManager.js";
import { getDisplayName } from "../../utils/memberUtils.js";
import { FindAllNonNullKeys } from "../../utils/profileManager.js";


const formatBirthdayLine = (
    guild: Guild | null, 
    member: UserProfile, 
    currentYear: number
): string => {
    const name = getDisplayName(guild, member.discordId);
    const mention = `(<@${member.discordId}>)`; 

    const birthdayDate = new Date((member.birthday as number) * 1000);
    const age = currentYear - birthdayDate.getFullYear();
	return `${name} ${mention} - ${age} Years old`;
};

const isBirthdayToday = (birthday: Date | null, date: Date): boolean => {
    if (!birthday) return false;

    const currentMonth = date.getMonth() + 1;
    const currentDay = date.getDate();
    
    // Standard birthday
    if (birthday.getMonth() + 1 === currentMonth && birthday.getDate() === currentDay) {
        return true;
    }

    // Leap year stuff
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (birthday.getMonth() + 1 === 2 && birthday.getDate() === 29 && currentMonth === 3 && currentDay === 1 && yesterday.getDate() !== 29) {
        return true;
    }

    return false;
};

// "server:user:month-day" of everyone that already got their message today, so setting a birthday on the day itself can't post it twice
const announced = new Set<string>();

/**
 * Sends the happy birthday message for these members in the birthday channel of the server
 * Anyone who already got one today is skipped
 */
export async function AnnounceBirthdays(client: Client, guild: Guild, members: UserProfile[]): Promise<void> {
    const today = new Date();
    const day = `${today.getMonth()}-${today.getDate()}`;

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
        const yearA = new Date((a.birthday as number) * 1000)?.getFullYear() || 0;
        const yearB = new Date((b.birthday as number) * 1000)?.getFullYear() || 0;
        return yearB - yearA; 
    });

    const descriptionLines = todaysBirthdays.map(member => 
        formatBirthdayLine(guild, member, today.getFullYear())
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
		const today = new Date();
        const servers = await FindAllNonNullKeysConfig("birthdayChannel");

        for (const server of servers){
            const guild = client.guilds.cache.get(server.id);
            if (!guild) continue;

            const birthdayMembers = await FindAllNonNullKeys("birthday", server.id);
            
            const todaysBirthdays = birthdayMembers.filter((member) => {
                const name = getDisplayName(guild, member.discordId);
                if (!name) return false;
                
                const birthday = member.birthday as UserProfile["birthday"] | null;
                const birthdayDate = birthday ? new Date(birthday * 1000) : null;

                if (!birthdayDate) return false;

                return isBirthdayToday(birthdayDate, today);
            });

            await AnnounceBirthdays(client, guild, todaysBirthdays);
        }
	},
};

export default repeating;
