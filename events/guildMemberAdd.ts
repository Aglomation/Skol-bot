import {
    type Client,
    EmbedBuilder,
    Events,
    type GuildMember,
    type TextChannel,
} from "discord.js";
import { GetProfile, UpdateProfile } from "../utils/profileManager.js";

export default {
    name: Events.GuildMemberAdd,
    once: false,
    async execute(member: GuildMember, client: Client) {
        // Check if the user is on the ban list
        var profile = await GetProfile(member.id);
        if (profile?.banned) {
            // If the ban duration has expired, remove the user from the ban list
            if (
                profile?.banduration &&
                new Date(profile.banduration).getTime() < Date.now()
            ) {
                await UpdateProfile(member.id, {
                    banned: false,
                    banreason: null,
                    banduration: null,
                });
            } else {
                try {
                    // Kick the user instead of ban to avoid IP-bans
                    await member.kick("User is softbanned");
                    console.log(`Kicked ${member.user.tag} (ban list)`);
                } catch (err) {
                    console.log(`Failed to kick ${member.user.tag}:`, err);
                }
                return;
            }
        }

        // Cast the channel to TextChannel so TypeScript knows we can use .send()
        const channel = (await client.channels
            .fetch("1497140071176863756")
            .catch(() => null)) as TextChannel | null;
        if (!channel) return;
        const embed = new EmbedBuilder()
            .setTitle("Välkommen")
            .setDescription(
                `Gå in i <id:customize> för att skaffa en custom färg.\n Gå in i <id:browse> för att se kanaler som är gömda by default.`,
            )
            .setColor(0x2b2d31)
            .setThumbnail(member.user.displayAvatarURL({ forceStatic: false }))
            .setFooter({
                text: `${member.guild.members.fetch().then((m) => m.filter((mm) => !mm.user.bot).size)} Medlemmar : ${new Date().toLocaleString("sv-SE")}`,
            });

        channel.send({
            content: `Välkommen ${member} till ${member.guild.name}!`,
            embeds: [embed],
        });
    },
};
