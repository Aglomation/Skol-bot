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
                if (!email || !verify) return;
                
                if (!email.endsWith("lbs.se")) return
                if (email.includes("+")) return
                
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
                message.delete()

            } catch (error) {
                console.error("Error processing verification webhook:", error);
            }
        }

        
    },
};