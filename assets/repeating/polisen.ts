import fs from "node:fs/promises";
import path from "node:path";
import axios from "axios";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type Client, type TextChannel } from "discord.js";

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
async function loadCache(): Promise<Map<number, PolisenEvent>> {
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
        const data = await fs.readFile(CACHE_FILE, "utf-8");
        const parsedData = JSON.parse(data);
        return new Map(parsedData.map((item: PolisenEvent) => [item.id, item]));
    } catch {
        return new Map(); // Return empty map if file doesn't exist or is invalid
    }
}

/**
 * Saves the Map values back to the cache file, sorted by datetime.
 */
async function saveCache(dataMap: Map<number, PolisenEvent>): Promise<void> {
    const mergedData = Array.from(dataMap.values()).sort((a, b) => {
        return new Date(b.datetime).getTime() - new Date(a.datetime).getTime();
    });
    await fs.writeFile(CACHE_FILE, JSON.stringify(mergedData, null, 0));
}

const repeating = {
    data: {
        immediate: true,
        repeating: true,
        time: 1 * 60 * 1000,
        clockTime: null,
    },
    async execute(client: Client) {
        const dataMap = await loadCache();

        const apiData = await axios.get(API_URL).then(res => res.data).catch((err) => {
            console.error("Error fetching polisen data:", err.message);
            return null;
        });

        if (!Array.isArray(apiData)) return;

        apiData.reverse();

        for (let i = 0; i < apiData.length; i++) {
            const item = apiData[i] as PolisenEvent;
            const isNew = !dataMap.has(item.id);

            if (isNew) {
                console.log(`New item found: ${item.id} - ${item.summary}`);
                
                
                const channel = await client.channels.fetch("1525370464950554724") as TextChannel;
                if (!channel) return;

                const isHiddenType = hideTypes.some(type => new RegExp(`\\b${type}\\b`, "i").test(item.type));

                const embed = new EmbedBuilder()
                    .setTitle(item.name)
                    .setDescription(
                        `**${isHiddenType ? "||":""}${item.summary}${isHiddenType ? "||":""}**`
                    )
                    .setURL(`${BASE_URL}${item.url}`)
                    .setAuthor({
                        name: "Polisen.se",
                        url: BASE_URL,
                        iconURL: "https://polisen.se/images/icons/favicon-32x32.png"
                    })
                    .setFooter({ text: `Written: ${new Date(item.datetime).toLocaleString()}` });

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setLabel("Läs mer")
                        .setEmoji("📰")
                        .setStyle(ButtonStyle.Primary)
                        .setCustomId(`poliseninfo:${item.id}`)
                );
                // await channel.send({ embeds: [embed], components: [row] });

                dataMap.set(item.id, item);
            }
        }

        await saveCache(dataMap);


    },
};

export default repeating;