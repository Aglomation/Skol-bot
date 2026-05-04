import { Client, TextChannel } from 'discord.js';

const repeating = {
    repeating: true,
    exactTime: "22:47",
    async execute(client: Client) {
        const logChannel = client.channels.cache.get('1499149296203993169') as TextChannel | undefined;
        if (logChannel) {
            await logChannel.send(`This will hopefully be sent at 22:47! Current time: <t:${Math.floor(Date.now() / 1000)}:T>`);
        }
    },
};

export default repeating;