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

// The test bot has the same code as the real one, but it must not post to the servers
const DEV_BOT_ID = "1499931865723830392";

// A lot of events flagged as updated at once means something went wrong (the list changed shape), not that the police updated that many
const MAX_UPDATES_PER_CHECK = 10;

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

type FoundEvents = {
    newEvents: PolisenEvent[];
    updatedEvents: PolisenEvent[];
    /** What to keep for the next check: the events of now, then the older ones that dropped out of the list */
    eventsToSave: PolisenEvent[];
};

/**
 * Compares the list polisen.se gives now with the events seen before
 * - new: not seen before
 * - updated: seen before, but now above the first event we know of, polisen moves an event to the top when it is updated
 * Both are in the order of the list, newest first
 */
function FindNewAndUpdated(apiEvents: PolisenEvent[], cachedEvents: PolisenEvent[]): FoundEvents {
    // an event can be in the list twice
    const apiIds = new Set<number>();
    const uniqueEvents = apiEvents.filter((item) => {
        if (apiIds.has(item.id)) return false;
        apiIds.add(item.id);
        return true;
    });

    const knownIds = new Set(cachedEvents.map((cached) => cached.id));

    // the first event we have seen before that is still in the list, everything above it came in after the last check
    const anchor = cachedEvents.find((cached) => apiIds.has(cached.id));
    const anchorIndex = anchor ? uniqueEvents.findIndex((fresh) => fresh.id === anchor.id) : -1;

    const newEvents: PolisenEvent[] = [];
    const updatedEvents: PolisenEvent[] = [];
    uniqueEvents.forEach((item, index) => {
        if (!knownIds.has(item.id)) {
            newEvents.push(item);
        } else if (anchorIndex !== -1 && index < anchorIndex) {
            // a known event above the anchor was bumped to the top
            updatedEvents.push(item);
        }
    });

    const olderEvents = cachedEvents.filter((cached) => !apiIds.has(cached.id));
    return { newEvents, updatedEvents, eventsToSave: [...uniqueEvents, ...olderEvents].slice(0, MAX_CACHED_EVENTS) };
}

/** The events polisen.se lists now, null if it can't be reached (it is in the console) */
async function FetchPolisenEvents(): Promise<PolisenEvent[] | null> {
    const events = await axios
        .get(API_URL, { headers: { "User-Agent": GetUserAgent() } })
        .then((response) => response.data)
        .catch((error) => {
            console.error("Error fetching polisen data:", error.message);
            return null;
        });

    return Array.isArray(events) ? events : null;
}

async function checkForNewEvents(client: Client) {
    const apiEvents = await FetchPolisenEvents();
    if (!apiEvents) return;

    const cachedEvents = await LoadPolisenCache();
    const found = FindNewAndUpdated(apiEvents, cachedEvents);

    if (found.updatedEvents.length > MAX_UPDATES_PER_CHECK) {
        console.warn(`${found.updatedEvents.length} items flagged as updated. Skipping`);
        found.updatedEvents.length = 0;
    }

    // Saved before sending, if something goes wrong halfway the events count as seen
    // The other way around the same events would be posted again every minute
    await SavePolisenCache(found.eventsToSave);

    // the first check only fills the cache, everything in it would look new
    if (cachedEvents.length === 0) return;

    // Sent in reverse to retain chronologic sequence
    for (const item of found.newEvents.reverse()) {
        console.log(`New item found: ${item.id} - ${item.summary}`);
        await sendEvent(client, item, false);
    }

    for (const item of found.updatedEvents.reverse()) {
        console.log(`Item updated (bumped to top): ${item.id}`);
        await sendEvent(client, item, true);
    }
}

const repeating: Repeating = {
    data: {
        immediate: true,
        repeating: true,
        time: 1 * 60 * 1000,
        clockTime: null,
    },
    async execute(client: Client) {
        if (client?.user?.id === DEV_BOT_ID) return;
        if (isProcessing) {
            console.log("Polisen check skipped: Previous check is still running.");
            return;
        }

        isProcessing = true;
        try {
            await checkForNewEvents(client);
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
