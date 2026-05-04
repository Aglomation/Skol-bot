import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { findAllKeyUsers, findAllUsersByValue } from '../../utils/profileManager.js'
const repeating = {
    repeating: true,
    exactTime: "00:00",
    async execute(client: Client) {
        const birthdayChannel = client.channels.cache.get('1497140071659212845') as TextChannel | undefined;
        if (!birthdayChannel) return;
        const date = new Date()

        const birthdayMembers = findAllKeyUsers("birthday").filter(({ value }) => {
            if (!value) return false;
            return value.month === date.getMonth() + 1 && value.day === date.getDate();
        });

        if (!birthdayMembers) return;

        console.log(birthdayMembers)
        const sortedMembers = birthdayMembers.sort((a, b) => 
            (b.value?.year || 0) - (a.value?.year || 0)
        );

        const embed = new EmbedBuilder()
            .setTitle('Happy Birthday!')
            .setDescription(sortedMembers.map(({ userId, value }) => `<@${userId}> - ${date.getFullYear() - (value?.year || 0)} Years old`).join('\n'))
            .setColor(0xff0000);

        const response = await birthdayChannel.send({ embeds: [embed], allowedMentions: { users: [] } });
        response.react('🎉').catch(() => null);
    },
};

export default repeating;