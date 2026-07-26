import type { Client, Guild, TextChannel } from "discord.js";
import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { FindAllNonNullKeysConfig } from "../../utils/configManager.js";
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

        console.log(servers)

        for (const server of servers){
            const birthdayChannel = client.channels.cache.get(server.birthdayChannel as string) as TextChannel | undefined;
            if (!client?.user || !birthdayChannel?.permissionsFor(client.user)?.has(PermissionFlagsBits.SendMessages)) continue;
            
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

            if (todaysBirthdays.length === 0) continue;

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

            response.react("🎉").catch(() => null);
        }
	},
};

export default repeating;
