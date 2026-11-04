import axios from "axios";
import type { Client, TextChannel } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import type { PolisenEvent } from "../../features/polisen.js";
import { IsEventPath, LoadPolisenCache, ParsePolisenTime, SavePolisenCache } from "../../features/polisen.js";
import { FindAllNonNullKeysConfig } from "../../utils/configManager.js";

const API_URL = "https://polisen.se/api/events";
const BASE_URL = "https://polisen.se";

// Who polisen.se can contact if the bot causes trouble, it comes from POLISEN_CONTACT in the .env
// It is read when it's used, the .env is only loaded after the imports
const GetUserAgent = (): string => {
    const contact = process.env.POLISEN_CONTACT;
    return contact ? `LBS Discord bot (${contact})` : "LBS Discord bot";
};

// only the newest are kept, otherwise the cache grows forever
const MAX_CACHED_EVENTS = 2000;

const hideTypes: Array<string> = [
    "rån",
    "inbrott",
    "misshandel",
    "skottlossning",
    "våldtäkt",
    "mord",
    "personskada",
    "explosion",
    "kroppskada",
    "sexualbrott",
    "sedlighetsbrott",
    "olaga hot",
    "människorov",
    "dråp",
    "våld"
];
const HIDE_TYPES_REGEX = new RegExp(`\\b(${hideTypes.join("|")})\\b`, "i");

let isProcessing = false;

function createEventMessage(item: PolisenEvent, isUpdate: boolean): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
    const isHiddenType = HIDE_TYPES_REGEX.test(item.type);
    const description = isHiddenType ? `||${item.summary}||` : item.summary;

    const embed = new EmbedBuilder()
        .setTitle(item.name)
        .setColor(isUpdate ? Colors.DarkAqua : Colors.Aqua)
        .setAuthor({
            name: "Polisen.se",
            url: BASE_URL,
            iconURL: "https://polisen.se/images/icons/favicon-32x32.png"
        })
        .setFooter({ text: "Publicerad" })
        .setTimestamp(ParsePolisenTime(item.datetime));

    if (IsEventPath(item.url)) embed.setURL(`${BASE_URL}${item.url}`);

    if (isUpdate) {
        embed.setDescription(`**Uppdaterad!**\n${description}`);
    } else {
        embed.setDescription(description);
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setLabel("Läs mer")
            .setEmoji("📰")
            .setStyle(ButtonStyle.Primary)
            .setCustomId(`poliseninfo:${item.id}`)
    );

    return { embeds: [embed], components: [row] };
}

const repeating: Repeating = {
    data: {
        immediate: true,
        repeating: true,
        time: 1 * 60 * 1000,
        clockTime: null,
    },
    async execute(client: Client) {
        if (client?.user?.id === "1499931865723830392") return;
        if (isProcessing) {
            console.log("Polisen check skipped: Previous check is still running.");
            return;
        }

        isProcessing = true;
        try {
            const apiDataRaw: PolisenEvent[] = await axios.get(API_URL, {
                headers: { "User-Agent": GetUserAgent() },
            }).then(res => res.data).catch((err) => {
                console.error("Error fetching polisen data:", err.message);
                return null;
            });

            if (!Array.isArray(apiDataRaw)) return;

            // Makes sure there's no duplicates
            const seenApiIds = new Set<number>();
            const uniqueApiData = apiDataRaw.filter(item => {
                if (seenApiIds.has(item.id)) return false;
                seenApiIds.add(item.id);
                return true;
            });

            const cachedEvents = await LoadPolisenCache();
            const isCacheEmpty = cachedEvents.length === 0;

            const cacheMap = new Map<number, PolisenEvent>();
            cachedEvents.forEach(event => {
                cacheMap.set(event.id, event);
            });

            const anchorEvent = cachedEvents.find(e => seenApiIds.has(e.id));
            const anchorIndexInNew = anchorEvent
                ? uniqueApiData.findIndex(e => e.id === anchorEvent.id)
                : -1;

            const newEventsToSend: PolisenEvent[] = [];
            const updatedEventsToSend: PolisenEvent[] = [];

            // 5. Categorize the items using Anchor Logic
            for (let i = 0; i < uniqueApiData.length; i++) {
                const item = uniqueApiData[i];
                const isKnown = cacheMap.has(item.id);

                if (!isKnown) {
                    newEventsToSend.push(item);
                } else if (anchorIndexInNew !== -1 && i < anchorIndexInNew) {
                    // If an old item jumps ahead of our Anchor, it was bumped to the top!
                    updatedEventsToSend.push(item);
                }
            }

            // Hopefully fixes the spam if something goes wrong
            const MAX_UPDATES_PER_TICK = 10;
            if (updatedEventsToSend.length > MAX_UPDATES_PER_TICK) {
                console.warn(`${updatedEventsToSend.length} items flagged as updated. Skipping`);
                updatedEventsToSend.length = 0;
            }

            // Saved before sending, if something goes wrong halfway the events count as seen
            // The other way around the same events would be posted again every minute
            const historicalEvents = cachedEvents.filter(e => !seenApiIds.has(e.id));
            const allEvents = [...uniqueApiData, ...historicalEvents].slice(0, MAX_CACHED_EVENTS);

            await SavePolisenCache(allEvents);

            if (!isCacheEmpty) {
                // Sent in reverse to retain chronologic sequence
                for (const item of newEventsToSend.reverse()) {
                    console.log(`New item found: ${item.id} - ${item.summary}`);
                    await sendEvent(client, item, false);
                }

                for (const item of updatedEventsToSend.reverse()) {
                    console.log(`Item updated (bumped to top): ${item.id}`);
                    await sendEvent(client, item, true);
                }
            }
        } finally {
            isProcessing = false;
        }
    },
};
// one broken event must not stop the others from being posted
async function sendEvent(client: Client, item: PolisenEvent, isUpdate: boolean) {
    try {
        await sendMessagesToServers(client, createEventMessage(item, isUpdate));
    } catch (error) {
        console.error(`Could not post event ${item.id}:`, error);
    }
}

async function sendMessagesToServers(client: Client, message: { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] }) {
    const servers = await FindAllNonNullKeysConfig("policeChannel");

    for (const server of servers) {
        const channelId = server.policeChannel as string;
        const channel = client.channels.cache.get(channelId) as TextChannel | undefined;

        if (!client?.user || !channel?.permissionsFor(client.user)?.has(PermissionFlagsBits.SendMessages)) continue;

        await channel.send(message).catch(err => {
            console.error(`Failed to send message to channel ${channelId}:`, err);
        });
    }

}
export default repeating;
