import type { Client, GuildMember, TextChannel } from "discord.js";
import { EmbedBuilder, Events, PermissionFlagsBits } from "discord.js";
import { GetServerConfig } from "../utils/configManager.js";
import { SendLog } from "../utils/logChannel.js";
import { GetActiveBan, GetActiveMute, TimeoutLength } from "../utils/moderationManager.js";
import { GetProfileStrict } from "../utils/profileManager.js";


export default {
	name: Events.GuildMemberAdd,
	once: false,
	async execute(member: GuildMember, client: Client) {
		const profile = await loadProfile(member, client);
        
        // Check if the user is banned
        const isBanned = await handleSoftBanCheck(member, profile);
        if (isBanned) return;

        // A timeout is gone when they leave, so a mute that is still going is put back
        await handleMuteCheck(member, profile);

        // If they aren't banned, send the welcome message
        await sendWelcomeMessage(member, client);
    },
};

// The ban list is checked with this, so a database that is down for a moment must not let a banned user in without anyone knowing
// It tries a few times, and if it still fails the moderators are told so they can check by hand
async function loadProfile(member: GuildMember, client: Client): Promise<UserProfile | null> {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            return await GetProfileStrict(member.id, member.guild.id);
        } catch (err) {
            console.error(`Could not check the ban list for ${member.id} (attempt ${attempt}):`, err);
            if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        }
    }

    await SendLog(client, member.guild.id, `I couldn't check the ban list for <@${member.id}> because the database didn't answer, please check them by hand.`);
    return null;
}

async function handleSoftBanCheck(member: GuildMember, profile: UserProfile | null): Promise<boolean> {
    // If there's no active ban (or profile), the user isn't banned
    if (!GetActiveBan(profile)) return false;

    try {
        await member.kick("User is softbanned");
        console.log(`Kicked ${member.user.tag} (ban list active)`);
        await SendLog(member.client, member.guild.id, `<@${member.id}> is on the ban list and was kicked.`);
    } catch (err) {
        console.log(`Failed to kick ${member.user.tag}:`, err);
        await SendLog(member.client, member.guild.id, `<@${member.id}> is on the ban list but I couldn't kick them, please do it by hand.`);
    }
    
    return true; // User is banned
}

async function handleMuteCheck(member: GuildMember, profile: UserProfile | null) {
    const mute = GetActiveMute(profile);
    if (!mute) return;

    try {
        await member.timeout(TimeoutLength(mute.action.until), "Mute is still active, they left and joined again");
        await SendLog(member.client, member.guild.id, `<@${member.id}> joined while muted (case #${mute.number}), the mute was put back.`);
    } catch (err) {
        console.error(`Failed to put the mute back on ${member.user.tag}:`, err);
        await SendLog(member.client, member.guild.id, `<@${member.id}> joined while muted (case #${mute.number}) but I couldn't put the mute back, please do it by hand.`);
    }
}

async function sendWelcomeMessage(member: GuildMember, client: Client) {
    const channel = client.channels.cache
        .get(await GetServerConfig(member.guild.id, "welcomeChannel") as string) as TextChannel | null;
        
    if (!client?.user || !channel?.permissionsFor(client.user)?.has(PermissionFlagsBits.SendMessages)) return;

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
            text: `${humanMemberCount} Medlemmar ・ ${new Date().toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" })}`,
        });

    await channel.send({
        content: `Välkommen ${member} till ${member.guild.name}!`,
        embeds: [embed],
    });
}