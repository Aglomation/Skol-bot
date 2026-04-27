import 'dotenv/config';
import fs from 'fs';
import { Client, Collection, GatewayIntentBits, REST, Routes } from 'discord.js';
import { loadBanlist, saveBanlist } from './utils/banManager.js';

// Ensure environment variables exist
if (!process.env.token || !process.env.clientId) {
    throw new Error("Missing environment variables: token or clientId");
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ],
});

client.commands = new Collection();
// client.autocompletes = new Collection();
// client.buttons = new Collection();

client.banList = loadBanlist();
client.saveBanlist = () => saveBanlist(client.banList);

const fileFilter = (file: string) => file.endsWith('.ts') || file.endsWith('.js');

async function startBot() {
    // --- 1. Load Events ---
    const eventFiles = fs.readdirSync('./events').filter(fileFilter);
    for (const file of eventFiles) {
        const { default: event } = await import(`./events/${file}`);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
    }

    // --- 2. Load Commands and Components ---
    const commandFiles = fs.readdirSync('./assets/commands').filter(fileFilter);
    const commandsData: any[] = [];

    for (const file of commandFiles) {
        const { default: command } = await import(`./assets/commands/${file}`);
        client.commands.set(command.data.name, command);
        commandsData.push(command.data.toJSON());
    }

    // --- 3. Register Slash Commands ---
    const rest = new REST({ version: '10' }).setToken(process.env.token as string);

    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(process.env.clientId as string),
            { body: commandsData },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error deploying commands:', error);
    }

    // Log in at the very end
    client.login(process.env.token);
}

// Execute the function to start the bot
startBot();