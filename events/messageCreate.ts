import { Client, Events, GuildMember, Message } from 'discord.js';
import { updateProfileValue, findUserByValue } from '../utils/profileManager.js';

export default {
    name: Events.MessageCreate,
    once: false,
    async execute(message:Message,client: Client) {
        if (message.channel.id == "1497140071176863755"){
            message.member?.timeout(24 * 60 * 60 * 1000, `Honeypot triggered, DM an admin when you've recovered your account`)
            message.delete()
        }
        if (message.channel.id === "1498837870876688434" && message.webhookId === "1498837897527431188") {
            try {
                // Removes all whitespace before splitting
                const [email, verify] = message.content.replace(/\s+/g, '').split("$$");
                if (!email || !verify) return; // Guard clause in case the webhook format breaks

                const id = findUserByValue("verifycode", verify.toLowerCase());
                if (!id) return; // Exit if no matching user is found

                updateProfileValue(id, "email", email);

                // Fetch member using the ID as a string, catching potential errors if they left
                const member = await message.guild?.members.fetch(String(id)).catch(() => null);
                
                // Check if the member exists BEFORE trying to modify them
                if (!member) return; 

                // Fetch only the specific role you need, rather than caching all server roles
                const roleId = '1498832228145168514';
                const role = await message.guild?.roles.fetch(roleId).catch(() => null);

                if (role) {
                    await member.roles.add(role);
                } else {
                    console.warn(`Verification role ${roleId} not found in the guild.`);
                }

            } catch (error) {
                console.error("Error processing verification webhook:", error);
            }
        }

        
    },
};