import fs from "node:fs/promises";
import path from "node:path";
import axios from "axios";
import * as cheerio from "cheerio";
import type { ButtonInteraction, Client } from "discord.js";
import { EmbedBuilder, MessageFlags } from "discord.js";
import type { PolisenEvent } from "../repeating/polisen.js";

const CACHE_DIR = "./cache";
const CACHE_FILE = path.join(CACHE_DIR, "polisen.json");
const USER_AGENT = "LBS Discord bot (Vera Heltborg; vera.heltborg@proton.me)";

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
 * Scrapes the individual event article for updates and details.
 */

async function scrapeEventDetails(url: string): Promise<{ lastUpdated: string | null ; mainContent: string; Writer: string }> {
    const { data } = await axios.get(`https://polisen.se${url}`, {
        headers: {
            "User-Agent": USER_AGENT,
        },
    });
    const $ = cheerio.load(data);
    const contentDiv = $('div.event-page.editorial-content').eq(0);

    const lastUpdated = contentDiv.
        find('span.text')
        .eq(0)
        .text()
        .trim();

    const mainContent = contentDiv.
        find('div.text-body.editorial-html')
        .eq(0)
        .text()
        .trim() || "No additional details provided.";

    const Writer = contentDiv.
        find('div.page-meta-data')
        .eq(1)
        .text()
        .trim();

    return { lastUpdated, mainContent, Writer };
}

/**
 * Formats the raw scraped text to make it readable for Discord embeds.
 */
const formatMainContent = (text: string) => {
    if (!text) return "";
    let formatted = text.replace(/([^\n])\n([^\n])/g, "$1\n\n$2");

    // 2. Process line-by-line to catch updates and timestamps
    formatted = formatted
        .split("\n")
        .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return line;

            const timeRegex = /\b\d{1,2}[:.]\d{2}\b/;
            if (trimmed.length < 60 && timeRegex.test(trimmed)) {
                return `📝 **${trimmed}**`;
            }

            return line;
        })
        .join("\n");

    return formatted

};

const truncateText = (text: string, maxLength: number) => {
    if (!text) return "";
    return text.length > maxLength ? `${text.substring(0, maxLength - 3)}...` : text;
};

const button: Button = {
    data: {
        customId: "poliseninfo",
    },
    async execute(
        interaction: ButtonInteraction,
        _client: Client,
    ): Promise<void> {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const id = parseInt(interaction.customId.split(":")[1], 10) || null;
		if (!id) {
			await interaction.editReply({
				content: "Invalid page number.",
			});
			return;
		}
        const database = await loadCache();
        const event = database.get(id);
        if (!event) {
            await interaction.editReply({
                content: "Event not found in local database, erm contact Vera.",
            });
            return;
        }

		// webscrape the page for more info
		const { lastUpdated, mainContent, Writer } = await scrapeEventDetails(event.url);

        const time = new Date(`${event.name.match(/(\d{1,2} \w+) \d{2}\.\d{2}/)?.[0].replace(".", ":")} ${new Date().getFullYear()}` || 0);

        const embed = new EmbedBuilder()
            
            .setTitle(event.name)
            .setURL(`https://polisen.se${event.url}`)
            // Put main content in the description to utilize the 4096 char limit
            .setDescription(truncateText(formatMainContent(mainContent), 4000))
            .addFields(
                { name: "Typ", value: event.type, inline: true },
                { name: "Plats", value: `[${event.location.name}](https://www.google.com/maps/search/${encodeURIComponent(event.location.name)})`, inline: true },
                { name: "Tid", value: `<t:${Math.floor(time.getTime() / 1000)}:R>`, inline: true },
                { name: "Skribent", value: Writer || "Okänd", inline: true },
            )
            .setColor(0x005293)
            .setFooter({ 
                text: `${lastUpdated ? lastUpdated : "Polisen.se"} ・ Publicerad ${new Date(event.datetime).toLocaleString()}`,
                iconURL: "https://polisen.se/images/icons/favicon-32x32.png"
            });

        // Actually send the embed instead of dumping raw text
        await interaction.editReply({
            content: null, // Clear out any previous text
            embeds: [embed],
        });
    },
};

export default button;
