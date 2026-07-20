import type {
    Client,
    GuildTextBasedChannel,
    Message,
    TextChannel,
} from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events } from "discord.js";
import { FindByValue, UpdateProfile } from "../utils/profileManager.js";
import { purgeChannels } from "../utils/purgeMessages.js";

const CONFIG = {
    CHANNELS: {
        LOG: "1499149296203993169",
        AUTO_DELETE: "1498834244854878209",
        HONEYPOT: "1497140071176863755",
        VERIFYBACKEND: "1498837870876688434",
        TICKET_SUPPORT: "1499885683995840683",
    },
    ROLES: {
        VERIFIED: "1498832228145168514",
        TEACHER: "1497140069872435217",
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
            case CONFIG.CHANNELS.AUTO_DELETE:
                await handleAutoDelete(message);
                break;
            case CONFIG.CHANNELS.HONEYPOT:
                await handleHoneypot(message, client);
                break;
            case CONFIG.CHANNELS.VERIFYBACKEND:
                await handleVerification(message);
                break;
        }
    },
};

async function handleDMLogging(message: Message, client: Client) {
    const logChannel = client.channels.cache.get(CONFIG.CHANNELS.LOG) as TextChannel | undefined;
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
    const logChannel = client.channels.cache.get(CONFIG.CHANNELS.LOG) as TextChannel | undefined;

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

async function handleVerification(message: Message) {
    if (message.webhookId !== CONFIG.WEBHOOKS.VERIFYBACKEND) return;

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

        const userId = profile.id;
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
            await sendInvalidEmailNotice(message, profile.id, email, verify);
            return;
        }

        await UpdateProfile(userId, { email });
        await assignVerificationRoles(message, userId, email);
        await message.delete().catch(() => null);

    } catch (error) {
        console.error("Error processing verification webhook:", error);
    }
}

async function sendInvalidEmailNotice(message: Message, userId: string, email: string, verifyCode: string) {
    await message.reply(`Sending dm to <@${userId}> about invalid email`).catch(() => null);
    
    const embed = new EmbedBuilder()
        .setTitle("❌ Ogiltig LBS-mail")
        .setDescription(
            `Mailen du försökte verifiera med är inte en giltig LBS-mail.\n\n` +
            `\`${email}\` Slutar inte med @lbs.se, byt konto och försök igen!\n\n` +
            `*Problem? Skapa en ticket i <#${CONFIG.CHANNELS.TICKET_SUPPORT}>.*`
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

async function assignVerificationRoles(message: Message, userId: string, email: string) {
    let member = message.guild?.members.cache.get(userId) || null;
    
    if (!member) {
        console.error(`Failed to fetch member for user ID ${userId} from cache, attempting API fetch.`);
        member = await message.guild?.members.fetch(userId).catch(() => null) || null;
    }

    if (!member) {
        console.error(`Failed to fetch member for user ID ${userId} from API.`);
        await message.reply("Verification succeeded but failed to fetch member data.").catch(() => null);
        return;
    }

    const verifiedRole = message.guild?.roles.cache.get(CONFIG.ROLES.VERIFIED);
    if (verifiedRole) await member.roles.add(verifiedRole);

	// Gives the teacher role automatically to teachers
    if (email.endsWith("@ga.lbs.se") || email.endsWith("@lbs.se")) {
        const teacherRole = message.guild?.roles.cache.get(CONFIG.ROLES.TEACHER);
        if (teacherRole) await member.roles.add(teacherRole);
    }
}