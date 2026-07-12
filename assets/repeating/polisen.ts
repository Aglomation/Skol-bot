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
    "kroppskada"
];

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
    await fs.writeFile(CACHE_FILE, JSON.stringify(data, null, 2));
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
            const cachedEvents = await loadCache();
            const cachedIds = cachedEvents.map(e => e.id);

            const apiDataRaw = await axios.get(API_URL, {
                headers: {
                    "User-Agent": USER_AGENT,
                },
            }).then(res => res.data).catch((err) => {
                console.error("Error fetching polisen data:", err.message);
                return null;
            });

            if (!Array.isArray(apiDataRaw)) return;

            // Makes sure there's no duplicates
            const seenIds = new Set<number>();
            const apiData: PolisenEvent[] = [];
            for (const item of apiDataRaw) {
                if (!seenIds.has(item.id)) {
                    seenIds.add(item.id);
                    apiData.push(item);
                }
            }
            
            const currentIds = apiData.map(e => e.id);
            const currentIdsSet = new Set(currentIds);
            let expectedOldOrder = cachedIds.filter(id => currentIdsSet.has(id));

            const isCacheFileEmpty = cachedEvents.length === 0;

            const channel = await client.channels.fetch("1525548308385370253") as TextChannel;
            if (!channel) return;

            const newEventsToSend: PolisenEvent[] = [];
            const updatedEventsToSend: PolisenEvent[] = [];

            for (const item of apiData) {
                const isNew = !cachedIds.includes(item.id);

                if (isNew) {
                    newEventsToSend.push(item);
                } else {
                    if (expectedOldOrder[0] === item.id) {
                        expectedOldOrder.shift();
                    } else {
                        // Found an update
                        updatedEventsToSend.push(item);
                        expectedOldOrder = expectedOldOrder.filter(id => id !== item.id);
                    }
                }
            }

            // Hopefully fixes the spam if something goes wrong
            const MAX_UPDATES_PER_TICK = 6767;
            if (updatedEventsToSend.length + newEventsToSend.length > MAX_UPDATES_PER_TICK) {
                console.warn(`Max updateds hit ${updatedEventsToSend.length+newEventsToSend.length} items flagged as updated.`);
                updatedEventsToSend.length = 0;
                newEventsToSend.length = 0;
            }

            if (!isCacheFileEmpty) {
                // New Events
                for (const item of [...newEventsToSend].reverse()) {
                    console.log(`New item found: ${item.id} - ${item.summary}`);
                    const isHiddenType = hideTypes.some(type => new RegExp(`\\b${type}\\b`, "i").test(item.type));

                    const embed = new EmbedBuilder()
                        .setTitle(item.name)
                        .setDescription(`${isHiddenType ? "||":""}${item.summary}${isHiddenType ? "||":""}`)
                        .setURL(`${BASE_URL}${item.url}`)
                        .setAuthor({
                            name: "Polisen.se",
                            url: BASE_URL,
                            iconURL: "https://polisen.se/images/icons/favicon-32x32.png"
                        })
                        .setFooter({ text: `Publicerad: ${new Date(item.datetime).toLocaleString()}` })
                        .setColor(Colors.Aqua);

                    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setLabel("Läs mer")
                            .setEmoji("📰")
                            .setStyle(ButtonStyle.Primary)
                            .setCustomId(`poliseninfo:${item.id}`)
                    );

                    await channel.send({ embeds: [embed], components: [row] });
                }

                // Updates
                for (const item of [...updatedEventsToSend].reverse()) {
                    console.log(`Item updated (bumped to top): ${item.id}`);
                    const embed = new EmbedBuilder()
                        .setTitle(item.name)
                        .setDescription(`Updated!`)
                        .setURL(`${BASE_URL}${item.url}`)
                        .setFooter({ 
                            text: `Polisen.se ・ Publicerad ${new Date(item.datetime).toLocaleString()}`,
                            iconURL: "https://polisen.se/images/icons/favicon-32x32.png"
                        })
                        .setColor(Colors.DarkAqua);

                    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setLabel("Läs mer")
                            .setEmoji("📰")
                            .setStyle(ButtonStyle.Primary)
                            .setCustomId(`poliseninfo:${item.id}`)
                    );

                    await channel.send({ embeds: [embed], components: [row] });
                }
            }

            // New stuff
            const apiDataIds = new Set(apiData.map(e => e.id));
            // Old stuff
            const historicalEvents = cachedEvents.filter(e => !apiDataIds.has(e.id));
            // All stuff
            const allEvents = [...apiData, ...historicalEvents];
            
            await saveCache(allEvents);
        } finally {
            isProcessing = false;
        }
    },
};

export default repeating;