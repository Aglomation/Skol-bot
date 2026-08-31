import type {
    Client,
    Guild,
    GuildTextBasedChannel,
    Message,
    TextChannel,
} from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events } from "discord.js";
import { GetServerConfig } from "../utils/configManager.js";
import { FindByValue, UpdateProfile } from "../utils/profileManager.js";
import { purgeChannels } from "../utils/purgeMessages.js";

const CONFIG = {
    CHANNELS: {
        PRIVATELOG: "1499149296203993169",
        AUTO_DELETE: "1498834244854878209",
        VERIFYBACKEND: "1498837870876688434",
    },
    WEBHOOKS: {
        VERIFYBACKEND: "1498837897527431188",
    }
};

export default {
    name: Events.MessageCreate,
    once: false,
    async execute(message: Message, client: Client) {
        if (!message.guild) {
            if (message.author.id !== client.user?.id) {
                await handleDMLogging(message, client);
				message.react("📩").catch(() => null);
            }
            return; 
        }

        switch (message.channel.id) {
            // Might make this a server config option later
            case CONFIG.CHANNELS.AUTO_DELETE:
                await handleAutoDelete(message);
                break;
            case "1497140071176863755"://await GetServerConfig(message.guild.id, "honeypotChannel") as string:
                await handleHoneypot(message, client);
                break;
            // This only exists on the official server
            case CONFIG.CHANNELS.VERIFYBACKEND:
                await handleVerification(message, client);
                break;
        }
    },
};

async function handleDMLogging(message: Message, client: Client) {
    // dms only goes to the private log channel
    const serverlog = CONFIG.CHANNELS.PRIVATELOG;
    const logChannel = client.channels.cache.get(serverlog) as TextChannel | undefined;
    if (!logChannel) return;

    await logChannel.send(
        `DM received from ${message.author.tag} (${message.author.id}):\n${message.content}`
    );
}

async function handleAutoDelete(message: Message) {
    if (!message.member?.permissions.has("Administrator")) {
        await message.delete().catch(() => null);
    }
}

async function handleHoneypot(message: Message, client: Client) {
    if (message.member?.permissions.has("Administrator")) return;
	if (!message.guild) return;

    const compromisedUserId = message.author.id;
    
    const logChannel = client.channels.cache.get(await GetServerConfig(message.guild.id, "logChannel") as string) as TextChannel | undefined;

    if (logChannel) {
        await logChannel.send(`Honeypot triggered by <@${compromisedUserId}>! Wiping messages`);
    }

    // Quarantine and delete
    await message.member?.timeout(3 * 24 * 60 * 60 * 1000).catch(() => null);
    await message.delete().catch(() => null);

    // Purge logic
    const channels = message.guild.channels.cache.filter((c) => c.isTextBased());
    const channelsArray = channels.map((c) => c as GuildTextBasedChannel);
    const results = await purgeChannels(channelsArray, compromisedUserId);
    const totalDeleted = results.reduce((acc, curr) => acc + curr, 0);

    if (logChannel) {
        await logChannel.send(
            `Honeypot wipe complete. Wiped ${totalDeleted+1} messages from <@${compromisedUserId}>.`
        );
    }
}

async function handleVerification(message: Message, client: Client) {
    if (message.webhookId !== CONFIG.WEBHOOKS.VERIFYBACKEND) return;
    if (!message.guild) return;

    try {
        const [email, verify] = message.content.replace(/\s+/g, "").split("$$");
        
        if (!email || !verify) {
            await message.reply("Invalid formatting, didn't include two parts split by $$").catch(() => null);
            return;
        }

        const profile = await FindByValue("verifycode", verify);
        if (!profile) {
            await message.reply("Invalid verification code.").catch(() => null);
            return;
        }

        const userId = profile.discordId;
        if (!userId) {
            await message.reply("Verification code found but no ID was tied to it").catch(() => null);
            return;
        }

        if (profile.email && profile.email !== email) {
            await message.reply(`This verification code has already been used with a different email.\n[${profile.email}]`).catch(() => null);
            return;
        }

        // checks for valid email while allowing subdomains
        const isValidEmail = /@(?:[a-z0-9-]+\.)*(?:lbs\.se|dbgy\.se|learnet\.se)$/i.test(email) && !email.includes("+");
        if (!isValidEmail) {
            await sendInvalidEmailNotice(message, profile.discordId, email, verify);
            return;
        }

        await UpdateProfile(userId, profile.serverId, { email });
        await assignVerificationRoles(client.guilds.cache.get(profile.serverId), userId, email);
        await message.delete().catch(() => null);

    } catch (error) {
        console.error("Error processing verification webhook:", error);
    }
}

async function sendInvalidEmailNotice(message: Message, userId: string, email: string, verifyCode: string) {
    await message.reply(`Sending dm to <@${userId}> about invalid email`).catch(() => null);
    const supportChannel = await GetServerConfig(message.guild?.id || "", "supportChannel") as string | undefined;

    const embed = new EmbedBuilder()
        .setTitle("❌ Ogiltig LBS-mail")
        .setDescription(
            `Mailen du försökte verifiera med är inte en giltig LBS-mail.\n\n` +
            `\`${email}\` Slutar inte med @lbs.se, byt konto och försök igen!` +
            supportChannel ? `\n\n*Problem? Skapa en ticket i <#${supportChannel}>.*` : ""
        )
        .setColor(0xFF0000);

    const button = new ButtonBuilder()
        .setLabel("Försök igen")
        .setEmoji("🔄")
        .setStyle(ButtonStyle.Link)
        .setURL(`https://docs.google.com/forms/d/e/1FAIpQLSdiCU7923760A1fP07hDDfgcrvUxUUQFd_yWAdXggellFVW9w/viewform?usp=pp_url&entry.952629899=${verifyCode}`);

    const member = message.guild?.members.cache.get(userId);
    if (member) {
        await member.send({ 
            embeds: [embed], 
            components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)] 
        }).catch(() => null);
    }
}

async function assignVerificationRoles(guild: Guild | undefined, userId: string, email: string) {
    if (!guild) return;
    let member = guild.members.cache.get(userId) || null;
    
    if (!member) {
        console.error(`Failed to fetch member for user ID ${userId} from cache, attempting API fetch.`);
        member = await guild.members.fetch(userId).catch(() => null) || null;
        return;
    }

    const verifiedRole = guild.roles.cache.get(await GetServerConfig(guild.id, "verifiedRoleId") as string);
    if (verifiedRole) await member.roles.add(verifiedRole);

	// Gives the teacher role automatically to teachers
    if (email.endsWith("@ga.lbs.se") || email.endsWith("@lbs.se")) {
        const teacherRole = guild.roles.cache.get(await GetServerConfig(guild.id, "teacherRoleId") as string);
        if (teacherRole) await member.roles.add(teacherRole);
    }
}