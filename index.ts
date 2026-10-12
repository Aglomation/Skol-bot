import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { RESTPostAPIApplicationCommandsJSONBody } from "discord.js";
import {
	Client,
	Collection,
	GatewayIntentBits,
	Partials,
	REST,
	Routes,
} from "discord.js";
import dotenv from "dotenv";
import { sql } from "drizzle-orm";
import { db } from "./db/client.js";
import { serverConfigTable } from "./db/schema.js";


const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(process.cwd(), ".env"), quiet: true });

// Ensure environment variables exist
if (!process.env.TOKEN || !process.env.CLIENT_ID || !process.env.DATABASE_URL) {
	throw new Error(
		`Missing environment variables: TOKEN, CLIENT_ID or DATABASE_URL ${!!process.env.TOKEN} ${!!process.env.CLIENT_ID} ${!!process.env.DATABASE_URL}`,
	);
}

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildPresences,
	],
	partials: [Partials.Channel, Partials.Message],
});

client.commands = new Collection();
client.autocompletes = new Collection();
client.buttons = new Collection();
client.selectMenus = new Collection();

const fileFilter = (file: string) =>
	file.endsWith(".ts") || file.endsWith(".js");

async function startBot() {
	const [servers] = await db.select({ count: sql<number>`count(*)` }).from(serverConfigTable);
	console.log(`Database connected, ${servers.count} configured server(s).`);

	// Load events
	const eventsPath = path.join(__dirname, "events");
	const eventFiles = fs.readdirSync(eventsPath).filter(fileFilter);

	for (const file of eventFiles) {
		const filePath = path.join(eventsPath, file);
		const { default: event } = await import(pathToFileURL(filePath).href);

		// an error in a handler is logged here, a rejected promise nobody catches can take the whole bot down
		const run = async (...args: unknown[]) => {
			try {
				await event.execute(...args, client);
			} catch (error) {
				console.error(`[Error] Executing event ${event.name}:`, error);
			}
		};

		if (event.once) {
			client.once(event.name, run);
		} else {
			client.on(event.name, run);
		}
	}

	// Load commands, buttons, select menus, and autocompletes
	const commandsPath = path.join(__dirname, "assets", "commands");
	const commandEntries = fs.readdirSync(commandsPath);
	const commandsData: RESTPostAPIApplicationCommandsJSONBody[] = [];

	for (const entry of commandEntries) {
		const entryPath = path.join(commandsPath, entry);
		const stat = fs.statSync(entryPath);

		if (stat.isDirectory()) {
			const files = fs.readdirSync(entryPath).filter(fileFilter);
			const mainFile = files.find((f) => f.match(/^(main)\.(ts|js)$/));
			if (!mainFile) continue;
			const { default: command } = await import(
				pathToFileURL(path.join(entryPath, mainFile)).href
			);
			client.commands.set(command.data.name, command);
			commandsData.push(command.data.toJSON());
			continue;
		}
		if (fileFilter(entry)) {
			const { default: command } = await import(pathToFileURL(entryPath).href);
			client.commands.set(command.data.name, command);
			commandsData.push(command.data.toJSON());
		}
	}

	const buttonsPath = path.join(__dirname, "assets", "buttons");
	const buttonFiles = fs.readdirSync(buttonsPath).filter(fileFilter);

	for (const file of buttonFiles) {
		const filePath = path.join(buttonsPath, file);
		const { default: button } = await import(pathToFileURL(filePath).href);
		client.buttons.set(button.data.customId, button);
	}

	const selectMenusPath = path.join(__dirname, "assets", "selectmenus");
	const selectMenuFiles = fs.readdirSync(selectMenusPath).filter(fileFilter);

	for (const file of selectMenuFiles) {
		const filePath = path.join(selectMenusPath, file);
		const { default: selectMenu } = await import(pathToFileURL(filePath).href);
		client.selectMenus.set(selectMenu.data.customId, selectMenu);
	}

	const autocompletesPath = path.join(__dirname, "assets", "autocompletes");
	const autcompleteFiles = fs.readdirSync(autocompletesPath).filter(fileFilter);

	for (const file of autcompleteFiles) {
		const filePath = path.join(autocompletesPath, file);
		const { default: autocomplete } = await import(
			pathToFileURL(filePath).href
		);
		client.autocompletes.set(autocomplete.data.name, autocomplete);
	}

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
	await client.login(process.env.TOKEN);
}

async function loadRepeatingTasks() {
	const repeatingPath = path.join(__dirname, "assets", "repeating");
	const repeatingFiles = fs.readdirSync(repeatingPath).filter(fileFilter);

	for (const file of repeatingFiles) {
		const filePath = path.join(repeatingPath, file);
		const { default: repeating } = await import(pathToFileURL(filePath).href);
		const options = repeating.data;

		// one task failing must not stop the others or take the bot down
		const run = async () => {
			try {
				await repeating.execute(client);
			} catch (error) {
				console.error(`[Error] Repeating task ${file}:`, error);
			}
		};

		if (options.clockTime) {
			const [hours, minutes] = options.clockTime.split(":").map(Number);

			// works out the next time again after every run, so it stays on the clock time when the clocks change
			const scheduleDaily = () => {
				const now = new Date();
				const nextRun = new Date();
				nextRun.setHours(hours, minutes, 0, 0);

				// a timer can fire a little early, so anything within a second counts as already passed
				if (nextRun.getTime() <= now.getTime() + 1000) {
					nextRun.setDate(nextRun.getDate() + 1);
				}

				setTimeout(async () => {
					await run();
					scheduleDaily();
				}, nextRun.getTime() - now.getTime());
			};

			scheduleDaily();
		}
		if (options.repeating && options.time) {
			setInterval(run, options.time);
		}
		if (options.immediate) {
			await run();
		}
	}
}

client.once("clientReady", () => {
	loadRepeatingTasks().catch((error) => console.error("Error starting the repeating tasks:", error));
});

// logs instead of crashing, the bot should keep running if one thing fails
client.on("error", (error) => console.error("[Error] Discord client:", error));
process.on("unhandledRejection", (reason) => console.error("[Error] Unhandled rejection:", reason));

// Execute the function to start the bot
startBot().catch(console.error);
