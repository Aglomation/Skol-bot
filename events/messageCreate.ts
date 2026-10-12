import type {
    Client,
    GuildTextBasedChannel,
    Message,
    TextChannel,
} from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events } from "discord.js";
import { GetServerConfig } from "../utils/configManager.js";
import { SendLog } from "../utils/logChannel.js";
import { AddModAction } from "../utils/moderationManager.js";
import { FindByValue, PROFILE_DUPLICATE, UpdateProfile } from "../utils/profileManager.js";
import { purgeChannels } from "../utils/purgeMessages.js";
import { CompleteVerification } from "../utils/verifyFlow.js";

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
                await handleDMLogging(message);
				message.react("📩").catch(() => null);
            }
            return; 
        }

        // comes from the cache so it doesnt hit the database on every message
        const honeypotChannel = await GetServerConfig(message.guild.id, "honeypotChannel") as string | null;
        if (honeypotChannel && message.channel.id === honeypotChannel) {
            await handleHoneypot(message);
            return;
        }

        switch (message.channel.id) {
            // Might make this a server config option later
            case CONFIG.CHANNELS.AUTO_DELETE:
                await handleAutoDelete(message);
                break;
            // This only exists on the official server
            case CONFIG.CHANNELS.VERIFYBACKEND:
                await handleVerification(message);
                break;
        }
    },
};

async function handleDMLogging(message: Message) {
    const client = message.client;

    // dms only goes to the private log channel
    const serverlog = CONFIG.CHANNELS.PRIVATELOG;
    const logChannel = client.channels.cache.get(serverlog) as TextChannel | undefined;
    if (!logChannel) return;

    await logChannel.send(
        `DM received from ${message.author.username} (${message.author.id}):\n${message.content}`
    );
}

async function handleAutoDelete(message: Message) {
    if (!message.member?.permissions.has("Administrator")) {
        await message.delete().catch(() => null);
    }
}

async function handleHoneypot(message: Message) {
    if (message.member?.permissions.has("Administrator")) return;
	if (!message.guild) return;

    const client = message.client;
    const compromisedUserId = message.author.id;
    
    await SendLog(client, message.guild.id, `Honeypot triggered by <@${compromisedUserId}>! Wiping messages`);

    // Quarantine and delete
    const muteTime = 3 * 24 * 60 * 60 * 1000;
    const timedOut = await message.member?.timeout(muteTime).catch(() => null);

    // save it in the moderation history, the bot is the one that did it
    if (timedOut) {
        await AddModAction(compromisedUserId, message.guild.id, {
            type: "mute",
            by: client.user?.id ?? null,
            reason: "Honeypot triggered",
            until: Date.now() + muteTime,
        });
    }
    await message.delete().catch(() => null);

    // Purge logic
    const channels = message.guild.channels.cache.filter((c) => c.isTextBased());
    const channelsArray = channels.map((c) => c as GuildTextBasedChannel);
    const results = await purgeChannels(channelsArray, compromisedUserId);
    const totalDeleted = results.reduce((acc, curr) => acc + curr, 0);

    await SendLog(client, message.guild.id, `Honeypot wipe complete. Wiped ${totalDeleted+1} messages from <@${compromisedUserId}>.`);
}

async function handleVerification(message: Message) {
    if (message.webhookId !== CONFIG.WEBHOOKS.VERIFYBACKEND) return;
    if (!message.guild) return;
    const client = message.client;

    try {
        const [rawEmail, verify] = message.content.replace(/\s+/g, "").split("$$");
        
        if (!rawEmail || !verify) {
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
        
        if (profile.email) {
            await message.reply(`This user already has an email tied to their account.\n[${profile.email}]`).catch(() => null);
            return;
        }

        // lowercase so Name@lbs.se and name@lbs.se count as the same email
        const email = rawEmail.toLowerCase();

        // checks for valid email while allowing subdomains
        const isValidEmail = /@(?:[a-z0-9-]+\.)*(?:lbs\.se|dbgy\.se|learnet\.se)$/i.test(email) && !email.includes("+");
        if (!isValidEmail) {
            await sendInvalidEmailNotice(message, profile.discordId, email, verify);
            return;
        }

        const saved = await UpdateProfile(userId, profile.serverId, { email });
        if (saved === PROFILE_DUPLICATE) {
            // the email is unique, so another account already uses it, nobody gets verified on it twice
            await message.reply(`This email is already linked to another account.\n[${email}]`).catch(() => null);
            await sendEmailInUseNotice(client, profile.serverId, userId);
            return;
        }
        if (saved !== null) {
            await message.reply("Could not save the email, check the console.").catch(() => null);
            return;
        }

        const guild = client.guilds.cache.get(profile.serverId);
        const member = await guild?.members.fetch(userId).catch(() => null);
        if (!member) {
            await message.reply("The email was saved, but the user isn't in the server so no roles were given.").catch(() => null);
            return;
        }

        // the answers from the verify questions are only kept in memory, they are taken out in here
        await CompleteVerification(member, email);
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
            (supportChannel ? `\n\n*Problem? Skapa en ticket i <#${supportChannel}>.*` : "")
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

async function sendEmailInUseNotice(client: Client, serverId: string, userId: string) {
    const guild = client.guilds.cache.get(serverId);
    const supportChannel = await GetServerConfig(serverId, "supportChannel");
    
    const embed = new EmbedBuilder()
        .setTitle("❌ Mailen används redan")
        .setDescription(
            `Den LBS-mail du försökte verifiera med är redan kopplad till ett annat Discord-konto.` +
            (supportChannel ? `\n\n*Är det ditt gamla konto? Skapa en ticket i <#${supportChannel}>.*` : "")
        )
        .setColor(0xFF0000);

    const member = await guild?.members.fetch(userId).catch(() => null);
    await member?.send({ embeds: [embed] }).catch(() => null);
    }
