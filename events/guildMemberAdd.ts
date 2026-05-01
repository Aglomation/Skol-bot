import { GuildMember, Client, Events, TextChannel } from 'discord.js';
import { getValue, updateProfileValue } from '../utils/profileManager.js';

export default {
    name: Events.GuildMemberAdd,
    once: false,
    async execute(member: GuildMember, client: Client) {
        if (getValue(member.id, "banned")) {
            if (getValue(member.id, "banduration") && new Date(getValue(member.id, "banduration")!) < new Date()) {
                updateProfileValue(member.id, "banned", false);
                updateProfileValue(member.id, "banreason", null);
                updateProfileValue(member.id, "banduration", null);
            } else {
                try {
                    await member.kick('User is softbanned');
                    console.log(`Kicked ${member.user.tag} (ban list)`);
                } catch (err: any) {
                    console.log(`Failed to kick ${member.user.tag}:`, err.message);
                }
                return;
            }
        }

        // Cast the channel to TextChannel so TypeScript knows we can use .send()
        const channel = await client.channels.fetch('1497140071176863756').catch(() => null) as TextChannel | null;
        if (!channel) return;

        const embed = {
            title: "Välkommen",
            description: `Gå in i <id:customize> för att skaffa en custom färg.\n Gå in i <id:browse> för att se kanaler som är gömda by default.`,
            color: 0x2b2d31,
            thumbnail: {
                url: member.user.displayAvatarURL({ forceStatic: false }) // replaced dynamic: true with v14 standard
            },
            footer: {
                text: `${member.guild.members.cache.filter(m => !m.user.bot).size} Medlemmar : ${new Date().toLocaleString('sv-SE')}` // Hardcoded standard Swedish locale string
            }
        };

        channel.send({ content: `Välkommen ${member} till ${member.guild.name}!`, embeds: [embed] });
    },
};