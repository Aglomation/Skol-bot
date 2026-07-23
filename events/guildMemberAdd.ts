import type { Client, GuildMember, TextChannel } from "discord.js";
import { EmbedBuilder, Events } from "discord.js";

import { GetProfile, UpdateProfile } from "../utils/profileManager.js";
import { GetServerConfig } from "../utils/configManager.js";

const CONFIG = {
    TEST_BOT: "1410803606180986911",
    CHANNELS: {
        WELCOME: "1497140071176863756",
    }
};

export default {
	name: Events.GuildMemberAdd,
	once: false,
	async execute(member: GuildMember, client: Client) {
		const profile = await GetProfile(member.id);
        
        // Check if the user is banned
        const isBanned = await handleSoftBanCheck(member, profile);
        if (isBanned) return;

        // If they aren't banned, send the welcome message
        await sendWelcomeMessage(member, client);
    },
};

async function handleSoftBanCheck(member: GuildMember, profile: UserProfile): Promise<boolean> {
    // If there's no ban duration (or profile), the user isn't banned
    if (!profile?.banduration) return false;

    const banExpiration = parseInt(profile.banduration, 10);

    // Check if the current time is past the ban expiration
    if (Date.now() > banExpiration) {
        // Ban expired: clean up the database
        await UpdateProfile(member.id, member.guild.id, {
            banreason: null,
            banduration: null,
        });
        return false; // User is no longer banned
    }

    // Ban is not yet expired
    try {
        await member.kick("User is softbanned");
        console.log(`Kicked ${member.user.tag} (ban list active)`);
    } catch (err) {
        console.log(`Failed to kick ${member.user.tag}:`, err);
    }
    
    return true; // User is banned
}

async function sendWelcomeMessage(member: GuildMember, client: Client) {
    const channel = await client.channels
        .fetch(await GetServerConfig(member.guild.id, "welcomeChannel") as string)
        .catch(() => null) as TextChannel | null;
        
    if (!channel) return;

    // Filter out bots
    const humanMemberCount = member.guild.members.cache.filter((mm) => !mm.user.bot).size;

    const embed = new EmbedBuilder()
        .setTitle("Välkommen")
        .setDescription(
            `Gå in i <id:customize> för att skaffa en custom färg.\n Gå in i <id:browse> för att se kanaler som är gömda by default.`
        )
        .setColor(0x2b2d31)
        .setThumbnail(member.user.displayAvatarURL({ forceStatic: false }))
        .setFooter({
            text: `${humanMemberCount} Medlemmar ・ ${new Date().toLocaleString("sv-SE")}`,
        });

    await channel.send({
        content: `Välkommen ${member} till ${member.guild.name}!`,
        embeds: [embed],
    });
}