import type {
    Client,
    GuildTextBasedChannel,
    Message,
} from "discord.js";
import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events } from "discord.js";
import { IsSchoolEmail, MaskEmail } from "../features/emails.js";
import { CompleteVerification } from "../features/verify/flow.js";
import { GetServerConfig } from "../utils/configManager.js";
import { SafeError } from "../utils/errorText.js";
import { SendLog, SendToChannel } from "../utils/logChannel.js";
import { AddModAction } from "../utils/moderationManager.js";
import { FindByValue, PROFILE_DUPLICATE, UpdateProfile } from "../utils/profileManager.js";
import { PurgeChannels } from "../utils/purgeMessages.js";

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
            if (message.author.id !== client.user?.id && !message.author.bot) {
                await handleDMLogging(message);
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
    // dms only goes to the private log channel, by its id (SendLog wants a server)
    const attachments = message.attachments.size > 0 ? `\n(${message.attachments.size} attachment(s))` : "";
    const logged = await SendToChannel(
        message.client,
        CONFIG.CHANNELS.PRIVATELOG,
        `DM received from ${message.author.username} (${message.author.id}):\n${message.content}${attachments}`,
        message.attachments.map((a) => new AttachmentBuilder(a.url, { name: a.name ?? "attachment" })),
    );

    // the reaction shows that the staff will see it, so it only goes on when they will
    if (logged) await message.react("📩").catch(() => null);
}

async function handleAutoDelete(message: Message) {
    if (!message.member?.permissions.has("Administrator")) {
        await message.delete().catch(() => null);
    }
}

async function handleHoneypot(message: Message) {
    if (!message.guild) return;
    if (message.author.bot || message.webhookId) return;

    const member = message.member ?? await message.guild.members.fetch(message.author.id).catch(() => null);
    if (member?.permissions.has("Administrator")) return;

    const client = message.client;
    const compromisedUserId = message.author.id;
    await SendLog(client, message.guild.id, `Honeypot triggered by <@${compromisedUserId}>! Wiping messages`);

    // Quarantine and delete
    const muteTime = 3 * 24 * 60 * 60 * 1000;
    const timedOut = await member?.timeout(muteTime, "Honeypot triggered").catch(() => null);

    // save it in the moderation history, the bot is the one that did it
    if (timedOut) {
        await AddModAction(compromisedUserId, message.guild.id, {
            type: "mute",
            by: client.user?.id ?? null,
            reason: "Honeypot triggered",
            until: Date.now() + muteTime,
        });
    } else {
        await SendLog(client, message.guild.id, `I couldn't time out <@${compromisedUserId}>, their messages are still wiped.`);
    }
    await message.delete().catch(() => null);

    // Purge logic
    const textChannels = message.guild.channels.cache
        .filter((channel) => channel.isTextBased())
        .map((channel) => channel as GuildTextBasedChannel);
    const deletedPerChannel = await PurgeChannels(textChannels, compromisedUserId);
    const totalDeleted = deletedPerChannel.reduce((total, count) => total + count, 0);

    await SendLog(client, message.guild.id, `Honeypot wipe complete. Wiped ${totalDeleted+1} messages from <@${compromisedUserId}>.`);
}

/** The answer of the form in the channel is replied to, so the moderators see what became of it */
const replyToFormAnswer = (message: Message, text: string) => message.reply(text).catch(() => null);

type FormAnswer = { profile: UserProfile; email: string };

/**
 * Reads the message the verification form sends ("email$$code") and checks it
 * @returns who it is for and which email, null if something is wrong (the message is replied to with what)
 */
async function checkFormAnswer(message: Message): Promise<FormAnswer | null> {
    const [rawEmail, verifyCode] = message.content.replace(/\s+/g, "").split("$$");

    if (!rawEmail || !verifyCode) {
        await replyToFormAnswer(message, "Invalid formatting, didn't include two parts split by $$");
        return null;
    }

    const profile = await FindByValue("verifycode", verifyCode);
    if (!profile) {
        await replyToFormAnswer(message, "Invalid verification code.");
        return null;
    }

    if (!profile.discordId) {
        await replyToFormAnswer(message, "Verification code found but no ID was tied to it");
        return null;
    }

    if (profile.email) {
        await replyToFormAnswer(message, `This user already has an email tied to their account.\n[${MaskEmail(profile.email)}]`);
        return null;
    }

    // lowercase so Name@lbs.se and name@lbs.se count as the same email
    const email = rawEmail.toLowerCase();

    // checks for valid email while allowing subdomains
    if (!IsSchoolEmail(email)) {
        await sendInvalidEmailNotice(message, profile.discordId, email, verifyCode);
        return null;
    }

    return { profile, email };
}

/** Saves the email, and gives the member their roles. The form's message is deleted if it all worked */
async function saveEmailAndGiveRoles(message: Message, { profile, email }: FormAnswer) {
    const saved = await UpdateProfile(profile.discordId, profile.serverId, { email });
    if (saved === PROFILE_DUPLICATE) {
        // the email is unique, so another account already uses it, nobody gets verified on it twice
        await replyToFormAnswer(message, `This email is already linked to another account.\n[${MaskEmail(email)}]`);
        await sendEmailInUseNotice(message.client, profile.serverId, profile.discordId);
        return;
    }
    if (saved !== null) {
        await replyToFormAnswer(message, "Could not save the email, check the console.");
        return;
    }

    const guild = message.client.guilds.cache.get(profile.serverId);
    const member = await guild?.members.fetch(profile.discordId).catch(() => null);
    if (!member) {
        await replyToFormAnswer(message, "The email was saved, but the user isn't in the server so no roles were given.");
        return;
    }

    // the answers from the verify questions are only kept in memory, they are taken out in here
    const completed = await CompleteVerification(member, email);
    if (!completed) {
        // the message stays so the moderators see it
        await replyToFormAnswer(message, "The email was saved, but I couldn't give the roles (check that my role is above them). The user can press the verify button again to get them.");
        return;
    }

    await message.delete().catch(() => null);
}

async function handleVerification(message: Message) {
    if (message.webhookId !== CONFIG.WEBHOOKS.VERIFYBACKEND || !message.guild) return;

    try {
        const answer = await checkFormAnswer(message);
        if (answer) await saveEmailAndGiveRoles(message, answer);
    } catch (error) {
        console.error("Error processing verification webhook:", SafeError(error));
    }
}

async function sendInvalidEmailNotice(message: Message, userId: string, email: string, verifyCode: string) {
    await message.reply(`Sending dm to <@${userId}> about invalid email`).catch(() => null);
    const supportChannel = await GetServerConfig(message.guild?.id || "", "supportChannel") as string | undefined;

    // a + is an alias of another address, which is not allowed, and the reason is not the ending
    const reason = email.includes("+")
        ? `\`${email}\` innehåller ett +, använd mailen utan + och försök igen!`
        : `\`${email}\` Slutar inte med @lbs.se, byt konto och försök igen!`;

    const embed = new EmbedBuilder()
        .setTitle("❌ Ogiltig LBS-mail")
        .setDescription(
            `Mailen du försökte verifiera med är inte en giltig LBS-mail.\n\n` +
            reason +
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
