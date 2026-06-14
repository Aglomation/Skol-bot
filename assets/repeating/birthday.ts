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
	const birthday = member.birthday as UserProfile["birthday"] | null;
	const birthdayDate = birthday ? new Date(birthday * 1000) : null;
	
    const age = currentYear - (birthdayDate?.getFullYear() || 0); 
    
    return `${name || `<@${member.id}>`} - ${age} Years old`;
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
		const GUILD_ID = "1497140069746741338";
        const BIRTHDAY_CHANNEL_ID = "1497140071659212845";

		const guild = client.guilds.cache.get(GUILD_ID) || null;
		const birthdayChannel = client.channels.cache.get(BIRTHDAY_CHANNEL_ID) as
			| TextChannel
			| undefined;
		if (!birthdayChannel) return;

		const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentDay = today.getDate();
        const currentYear = today.getFullYear();

		const birthdayMembers = await FindAllNonNullKeys("birthday");

		const todaysBirthdays = birthdayMembers.filter((member) => {
			const birthday = member.birthday as UserProfile["birthday"] | null;
			const birthdayDate = birthday ? new Date(birthday * 1000) : null;
			return (
				birthdayDate &&
				birthdayDate.getMonth() + 1 === currentMonth &&
				birthdayDate.getDate() === currentDay
			);
		});

		if (todaysBirthdays.length === 0) return;

		todaysBirthdays.sort((a, b) => {
			return (
				((new Date(b.birthday || 0).getFullYear() as UserProfile["birthday"])) -
				((new Date(a.birthday || 0).getFullYear() as UserProfile["birthday"]))
			);
		});

		const descriptionLines = todaysBirthdays.map(member => 
			formatBirthdayLine(guild, member, currentYear)
		);

		const embed = new EmbedBuilder()
			.setTitle("🎉 Happy Birthday! 🎂")
			.setDescription(
				descriptionLines.join("\n")
			)
			.setFooter({
				text: `Use /birthday set to set your birthday!`,
			})
			.setColor(0xff0000);
			

		const response = await birthdayChannel.send({
			embeds: [embed],
			allowedMentions: { users: [] },
		});
		response.react("🎉").catch(() => null);
	},
};

export default repeating;
