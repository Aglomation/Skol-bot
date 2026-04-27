import { Client, Events, GuildMember, Message } from 'discord.js';

export default {
    name: Events.MessageCreate,
    once: false,
    execute(message:Message,client: Client) {
        if (message.channel.id == "1497140071176863755"){
            message.member?.timeout(24 * 60 * 60 * 1000, `Honeypot triggered, DM an admin when you've recovered your account`)
            message.delete()
        }
    },
};