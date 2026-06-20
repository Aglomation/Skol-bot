import type { Client, Guild, TextChannel } from "discord.js";
import { EmbedBuilder } from "discord.js";

import { getDisplayName } from "../../utils/memberUtils.js";
import { FindAllNonNullKeys } from "../../utils/profileManager.js";

const formatBirthdayLine = (
    guild: Guild | null, 
    member: UserProfile, 
    currentYear: number
): string => {
    const name = getDisplayName(guild, member.id);
    const mention = `(<@${member.id}>)`;

    if (!member.birthday?.year) return `${name} ${mention}`; 

	const age = currentYear - member.birthday.year;
	return `${name} ${mention} - ${age} Years old`;
};

const isBirthdayToday = (birthday: NonNullable<UserProfile["birthday"]>, date: Date): boolean => {
    const currentMonth = date.getMonth() + 1;
    const currentDay = date.getDate();
    
    // Standard birthday
    if (birthday.month === currentMonth && birthday.day === currentDay) {
        return true;
    }

    // Leap year stuff
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (birthday.month === 2 && birthday.day === 29 && currentMonth === 3 && currentDay === 1 && yesterday.getDate() !== 29) {
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

		// We should change this to be changeable by the server owner
		// this bot is private but might still be smart to not hardcode stuff :3
		const GUILD_ID = "1497140069746741338";
        const BIRTHDAY_CHANNEL_ID = "1497140071659212845";

		const guild = client.guilds.cache.get(GUILD_ID) || null;
		const birthdayChannel = client.channels.cache.get(BIRTHDAY_CHANNEL_ID) as
			| TextChannel
			| undefined;
		if (!birthdayChannel) return;

		const today = new Date();
		const birthdayMembers = await FindAllNonNullKeys("birthday");

        const todaysBirthdays = birthdayMembers.filter((member) => {
            if (!member.birthday) return false;
            return isBirthdayToday(member.birthday, today);
        });

		if (todaysBirthdays.length === 0) return;

		todaysBirthdays.sort((a, b) => {
            const yearA = (a.birthday as UserProfile["birthday"])?.year || 0;
            const yearB = (b.birthday as UserProfile["birthday"])?.year || 0;
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
	},
};

export default repeating;
