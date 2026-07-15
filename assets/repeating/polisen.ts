import fs from "node:fs/promises";
import path from "node:path";
import axios from "axios";
import type { Client, TextChannel } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors, EmbedBuilder } from "discord.js";

const CACHE_DIR = "./cache";
const CACHE_FILE = path.join(CACHE_DIR, "polisen.json");
const API_URL = "https://polisen.se/api/events";
const BASE_URL = "https://polisen.se";
const USER_AGENT = "LBS Discord bot (Vera Heltborg; vera.heltborg@proton.me)";
const CHANNEL_ID = "1499407739292749955";
export interface PolisenEvent {
	id: number; // 645957
    datetime: string; // "2026-07-02 11:57:10 +02:00"
    name: string; // "2 juli 11.31, Brand, Nyköping"
    summary: string; // "Brand i flerbostadshus, Nyköping"
    url: string; // "/aktuellt/handelser/2026/juli/2/2-juli-11.31-brand-nykoping/"
    type: string; // "Brand"
    location: {
        name: string; // "Södermanlands län"
        gps: string; // "59.033635,16.75189"
    };
}

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
    "sexualbrott"
];
const HIDE_TYPES_REGEX = new RegExp(`\\b(${hideTypes.join("|")})\\b`, "i");

let isProcessing = false;

/**
 * Loads the existing cache file into an Array.
 */
async function loadCache(): Promise<PolisenEvent[]> {
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
        const data = await fs.readFile(CACHE_FILE, "utf-8");
        return JSON.parse(data);
    } catch {
        return []; // Return empty array if file doesn't exist or is invalid
    }
}
/**
 * Saves the Array values back to the cache file.
 */
async function saveCache(data: PolisenEvent[]): Promise<void> {
    await fs.writeFile(CACHE_FILE, JSON.stringify(data, null, 0));
}

function createEventMessage(item: PolisenEvent, isUpdate: boolean) {
    const isHiddenType = HIDE_TYPES_REGEX.test(item.type);
    const description = isHiddenType ? `||${item.summary}||` : item.summary;

    const embed = new EmbedBuilder()
        .setTitle(item.name)
        .setURL(`${BASE_URL}${item.url}`)
        .setColor(isUpdate ? Colors.DarkAqua : Colors.Aqua)
        .setAuthor({
            name: "Polisen.se",
            url: BASE_URL,
            iconURL: "https://polisen.se/images/icons/favicon-32x32.png"
        })
        .setFooter({ text: `Publicerad: ${new Date(item.datetime).toLocaleString()}` });

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
        if (isProcessing) {
            console.log("Polisen check skipped: Previous check is still running.");
            return;
        }

        isProcessing = true;
        try {
            const channel = await client.channels.fetch(CHANNEL_ID) as TextChannel | null;
            if (!channel) return;



            const apiDataRaw: PolisenEvent[] = await axios.get(API_URL, {
                headers: { "User-Agent": USER_AGENT },
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

            const cachedEvents = await loadCache();
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
                const isNew = cacheMap.has(item.id);

                if (!isNew) {
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
                console.log(cacheMap, uniqueApiData, anchorEvent, anchorIndexInNew);
            }

            if (!isCacheEmpty) {
                // Sent in reverse to retain chronologic sequence
                for (const item of newEventsToSend.reverse()) {
                    console.log(`New item found: ${item.id} - ${item.summary}`);
                    await channel.send(createEventMessage(item, false));
                }

                for (const item of updatedEventsToSend.reverse()) {
                    console.log(`Item updated (bumped to top): ${item.id}`);
                    await channel.send(createEventMessage(item, true));
                }
            }

            const historicalEvents = cachedEvents.filter(e => !seenApiIds.has(e.id));
            const allEvents = [...uniqueApiData, ...historicalEvents];
            
            await saveCache(allEvents);
        } finally {
            isProcessing = false;
        }
    },
};

export default repeating;