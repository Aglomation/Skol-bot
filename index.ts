import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";
import {
    Client,
    Collection,
    GatewayIntentBits,
    REST,
    Routes,
} from "discord.js";
import { drizzle } from "drizzle-orm/neon-http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure environment variables exist
if (!process.env.TOKEN || !process.env.CLIENT_ID || !process.env.DATABASE_URL) {
    throw new Error(
        "Missing environment variables: TOKEN, CLIENT_ID or DATABASE_URL",
    );
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
    ],
});

client.commands = new Collection();
// client.autocompletes = new Collection();
client.buttons = new Collection();

const fileFilter = (file: string) =>
    file.endsWith(".ts") || file.endsWith(".js");

async function startBot() {
    // --- Database connection ---
    if (!process.env.DATABASE_URL) {
        console.error("DATABASE_URL is not set in environment variables.");
        return;
    }

    const sql = neon(process.env.DATABASE_URL!);
    const _db = drizzle({ client: sql });

    // --- 1. Load Events ---
    const eventsPath = path.join(__dirname, "events");
    const eventFiles = fs.readdirSync(eventsPath).filter(fileFilter);

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const { default: event } = await import(pathToFileURL(filePath).href);

        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
    }

    // TODO
    // Make it so folders in commands turns into subcommands of the main.ts file
    // - ./commands/birthday/main.ts (name: birthday, description: lorem ipsum)
    // - ./commands/birthday/set.ts
    // - ./commands/birthday/list.ts
    //
    // -> /birthday set
    // -> /birthday list

    // --- 2. Load Commands and Components ---
    const commandsPath = path.join(__dirname, "assets", "commands");
    const commandFiles = fs.readdirSync(commandsPath).filter(fileFilter);

    // TODO: Don't use "any" gng
    const commandsData: any[] = [];

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const { default: command } = await import(pathToFileURL(filePath).href);
        client.commands.set(command.data.name, command);
        commandsData.push(command.data.toJSON());
    }

    const buttonsPath = path.join(__dirname, "assets", "buttons");
    const buttonFiles = fs.readdirSync(buttonsPath).filter(fileFilter);

    for (const file of buttonFiles) {
        const filePath = path.join(buttonsPath, file);
        const { default: button } = await import(pathToFileURL(filePath).href);
        client.buttons.set(button.data.customId, button);
    }

    // const autocompletesPath = path.join(__dirname, 'assets', 'autocompletes');
    // const autcompleteFiles = fs.readdirSync(autocompletesPath).filter(fileFilter);

    // for (const file of autcompleteFiles) {
    //     const filePath = path.join(autocompletesPath, file);
    //     const { default: autocomplete } = await import(pathToFileURL(filePath).href);
    //     client.autocompletes.set(autocomplete.data.name, autocomplete);
    // }

    // --- 3. Register Slash Commands ---
    const rest = new REST({ version: "10" }).setToken(
        process.env.TOKEN as string,
    );

    try {
        console.log("Started refreshing application (/) commands.");
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID as string),
            { body: commandsData },
        );
        console.log("Successfully reloaded application (/) commands.");
    } catch (error) {
        console.error("Error deploying commands:", error);
    }

    // Log in at the very end
    client.login(process.env.TOKEN);
}

async function loadRepeatingTasks() {
    const repeatingPath = path.join(__dirname, "assets", "repeating");
    const repeatingFiles = fs.readdirSync(repeatingPath).filter(fileFilter);

    for (const file of repeatingFiles) {
        const filePath = path.join(repeatingPath, file);
        const { default: repeating } = await import(pathToFileURL(filePath).href);

        if (repeating.exactTime) {
            const [hours, minutes] = repeating.exactTime.split(":").map(Number);

            const scheduleDaily = () => {
                const now = new Date();
                const nextRun = new Date();
                nextRun.setHours(hours, minutes, 0, 0);
                console.log(now, nextRun);
                if (nextRun <= now) {
                    nextRun.setDate(nextRun.getDate() + 1);
                }

                const delay = nextRun.getTime() - now.getTime();
                setTimeout(() => {
                    repeating.execute(client);
                    setInterval(() => repeating.execute(client), 24 * 60 * 60 * 1000);
                }, delay);
            };

            scheduleDaily();
        }

        if (repeating.immediate) {
            await repeating.execute(client);
        }
    }
}

client.once("ready", () => {
    loadRepeatingTasks();
});

// Execute the function to start the bot
startBot().catch(console.error);
