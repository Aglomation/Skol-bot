import { Client, Events, Message, GuildTextBasedChannel, TextChannel } from 'discord.js';
import { updateProfileValue, findUserByValue } from '../utils/profileManager.js';

async function purgeScamMessages(channel: GuildTextBasedChannel, targetUserId: string): Promise<number> {
    try {
        const fetchedMessages = await channel.messages.fetch({ limit: 100 });
        
        // Filter for the users messages from the past hour
        const messagesToDelete = fetchedMessages.filter(msg => 
            msg.author.id === targetUserId && 
            msg.createdTimestamp >= Date.now() - (60 * 60 * 1000)
        );

        // Delete messages if found
        if (messagesToDelete.size > 0) {
            await channel.bulkDelete(messagesToDelete, true);
        }

        return messagesToDelete.size;
    } catch (error) {
        console.error(`Failed to purge messages in channel ${channel.id}:`, error);
        return 0;
    }
}

export default {
    name: Events.MessageCreate,
    once: false,
    async execute(message: Message, client: Client) {

        // Honeypot
        if (message.channel.id === "1497140071176863755" && !message.member?.permissions.has("Administrator")) {
            const compromisedUserId = message.author.id;

            const logChannel = client.channels.cache.get('1499149296203993169') as TextChannel | undefined;
            if (logChannel) await logChannel.send(`Honeypot triggered by <@${compromisedUserId}>!`);
            
            // Quarantine the user and delete the trigger message. 
            await message.member?.timeout(24 * 60 * 60 * 1000, `Honeypot triggered, DM an admin when you've recovered your account`).catch(() => null);
            await message.delete().catch(() => null);

            // Purge users messages from the past hour
            if (message.guild) {
                // Grab all text-based channels
                const channels = message.guild.channels.cache.filter(c => c.isTextBased());
                let totalDeleted = 0;

                for (const [_, channel] of channels) {
                    const deletedCount = await purgeScamMessages(channel as GuildTextBasedChannel, compromisedUserId);
                    totalDeleted += deletedCount;
                }
                if (logChannel) await logChannel.send(`Honeypot wipe complete. Wiped ${totalDeleted} messages from <@${compromisedUserId}>.`);
            }
            return; 
        }

        // Email Verification
        if (message.channel.id === "1498837870876688434" && message.webhookId === "1498837897527431188") {
            try {
                // Removes all whitespace before splitting
                const [email, verify] = message.content.replace(/\s+/g, '').split("$$");
                if (!email || !verify) return;
                
                if (!email.endsWith("lbs.se")) return;
                if (email.includes("+")) return;
                
                const id = findUserByValue("verifycode", verify.toLowerCase());
                if (!id) return; // exit if id is invalid

                updateProfileValue(id, "email", email);

                // Fetch member
                const member = await message.guild?.members.fetch(String(id)).catch(() => null);
                if (!member) return; 

                // Add verified role to the user
                const verifiedRole = await message.guild?.roles.fetch('1498832228145168514').catch(() => null);
                if (verifiedRole) {
                    await member.roles.add(verifiedRole);
                }

                // Give teacher role if email doesn't end with @elev.ga.lbs.se
                if (!email.endsWith("@elev.ga.lbs.se")){
                    const teacherRole = await message.guild?.roles.fetch('1497140069872435217').catch(() => null);

                    if (teacherRole) {
                        await member.roles.add(teacherRole);
                    }
                }
                
                // Deletes emails after being verified
                await message.delete().catch(() => null);

            } catch (error) {
                console.error("Error processing verification webhook:", error);
            }
        }
    },
};