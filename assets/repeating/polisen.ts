import fs from "node:fs/promises";
import path from "node:path";
import axios from "axios";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors, EmbedBuilder, type Client, type TextChannel } from "discord.js";

const CACHE_DIR = "./cache";
const CACHE_FILE = path.join(CACHE_DIR, "polisen.json");
const API_URL = "https://polisen.se/api/events";
const BASE_URL = "https://polisen.se";

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

const hideTypes = [
    "rån", 
    "inbrott", 
    "misshandel", 
    "skottlossning", 
    "våldtäkt",  
    "mord",
    "personskada"
];
/**
 * Loads the existing cache file into a Map for easy lookups by ID.
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
 * Saves the Map values back to the cache file, sorted by datetime.
 */
async function saveCache(data: PolisenEvent[]): Promise<void> {
    await fs.writeFile(CACHE_FILE, JSON.stringify(data, null, 2));
}

const repeating = {
    data: {
        immediate: true,
        repeating: true,
        time: 1 * 60 * 1000,
        clockTime: null,
    },
    async execute(client: Client) { 
        const cachedEvents = await loadCache();
        const cachedIds = cachedEvents.map(e => e.id);

        const apiData = await axios.get(API_URL).then(res => res.data).catch((err) => {
            console.error("Error fetching polisen data:", err.message);
            return null;
        });

        if (!Array.isArray(apiData)) return;
        
        const currentIds = apiData.map(e => e.id);

        // Filter the cached IDs down to ONLY those that still exist in the current API response.
        // This gives us the exact order we *expect* to see known items in.
        let expectedOldOrder = cachedIds.filter(id => currentIds.includes(id));

        const jsonempty = cachedEvents.length === 0;

        for (const item of apiData as PolisenEvent[]) {
            const isNew = !cachedIds.includes(item.id);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setLabel("Läs mer")
                    .setEmoji("📰")
                    .setStyle(ButtonStyle.Primary)
                    .setCustomId(`poliseninfo:${item.id}`)
            );

            if (isNew) {
                console.log(`New item found: ${item.id} - ${item.summary}`);
                
                const channel = await client.channels.fetch("1525370464950554724") as TextChannel;
                if (!channel) continue;

                const isHiddenType = hideTypes.some(type => new RegExp(`\\b${type}\\b`, "i").test(item.type));

                const embed = new EmbedBuilder()
                    .setTitle(item.name)
                    .setDescription(
                        `${isHiddenType ? "||":""}${item.summary}${isHiddenType ? "||":""}`
                    )
                    .setURL(`${BASE_URL}${item.url}`)
                    .setAuthor({
                        name: "Polisen.se",
                        url: BASE_URL,
                        iconURL: "https://polisen.se/images/icons/favicon-32x32.png"
                    })
                    .setFooter({ text: `Publicerad: ${new Date(item.datetime).toLocaleString()}` })
                    .setColor(Colors.Aqua);

                if (!jsonempty) {
                    await channel.send({ embeds: [embed], components: [row] });
                }
            } else {
                // If it's not new, it's a known item. Let's see if it's in the expected order.
                if (expectedOldOrder[0] === item.id) {
                    // It's exactly where we expected it. Pop it off our expected queue.
                    expectedOldOrder.shift();
                } else {
                    // It appeared BEFORE we expected it to! It was bumped/updated.
                    console.log(`Item updated (bumped to top): ${item.id}`);
                    
                    const channel = await client.channels.fetch("1525370464950554724") as TextChannel;
                    if (channel && !jsonempty) {
                        const embed = new EmbedBuilder()
                            .setTitle(item.name)
                            .setDescription(`Updated!`)
                            .setURL(`${BASE_URL}${item.url}`)
                            .setAuthor({
                                name: "Polisen.se",
                                url: BASE_URL,
                                iconURL: "https://polisen.se/images/icons/favicon-32x32.png"
                            })
                            .setColor(Colors.DarkAqua);

                        await channel.send({ embeds: [embed], components: [row] });
                    }
                    
                    // Remove it from the expected order queue so it doesn't throw off the rest of the list
                    expectedOldOrder = expectedOldOrder.filter(id => id !== item.id);
                }
            }
        }

        await saveCache(apiData);
    },
};

export default repeating;