import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Client, Collection, GatewayIntentBits, REST, Routes } from 'discord.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
client.buttons = new Collection();

const fileFilter = (file: string) => file.endsWith('.ts') || file.endsWith('.js');

async function startBot() {
    // --- 1. Load Events ---
    const eventsPath = path.join(__dirname, 'events'); 
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

    // --- 2. Load Commands and Components ---
    const commandsPath = path.join(__dirname, 'assets', 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(fileFilter);
    const commandsData: any[] = [];

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const { default: command } = await import(pathToFileURL(filePath).href);
        client.commands.set(command.data.name, command);
        commandsData.push(command.data.toJSON());
    }

    const buttonsPath = path.join(__dirname, 'assets', 'buttons');
    const buttonFiles = fs.readdirSync(buttonsPath).filter(fileFilter);

    for (const file of buttonFiles) {
        const filePath = path.join(buttonsPath, file);
        const { default: button } = await import(pathToFileURL(filePath).href);
        client.buttons.set(button.data.customId, button);
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