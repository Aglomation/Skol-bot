import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Collection as DiscordCollection, RESTPostAPIApplicationCommandsJSONBody } from "discord.js";
import { Client, Collection, GatewayIntentBits, Partials, REST, Routes } from "discord.js";
import dotenv from "dotenv";
import { sql } from "drizzle-orm";
import { db } from "./db/client.js";
import { serverConfigTable } from "./db/schema.js";
import { SafeError } from "./utils/errorText.js";
import { RecordTaskRun, RegisterTask } from "./utils/taskStatus.js";

// How the bot starts: see startBot() at the bottom. Everything under assets/ and events/ is found by looking in those
// folders, so a new command, button, event or repeating task only needs its file, nothing is registered in here.
 
const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(process.cwd(), ".env"), quiet: true });

const { token, clientId } = ReadEnvironment();

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

function ReadEnvironment(): { token: string; clientId: string } {
	const { TOKEN, CLIENT_ID, DATABASE_URL } = process.env;
	if (!TOKEN || !CLIENT_ID || !DATABASE_URL) {
		throw new Error(`Missing environment variables: TOKEN, CLIENT_ID or DATABASE_URL ${!!TOKEN} ${!!CLIENT_ID} ${!!DATABASE_URL}`);
	}

	return { token: TOKEN, clientId: CLIENT_ID };
}

const isScript = (file: string) => file.endsWith(".ts") || file.endsWith(".js");

/** The default export of every script in a folder of the project (assets/buttons, events...), in the order of the files */
async function ImportFolder<T>(...folder: string[]): Promise<{ file: string; module: T }[]> {
	const folderPath = path.join(__dirname, ...folder);
	const imported = [];

	for (const file of fs.readdirSync(folderPath).filter(isScript)) {
		const { default: module } = await import(pathToFileURL(path.join(folderPath, file)).href);
		imported.push({ file, module: module as T });
	}

	return imported;
}

/** Puts the default export of every script in assets/<folder> in the collection, under the key the script says */
async function RegisterAssets<T>(collection: DiscordCollection<string, T>, folder: string, keyOf: (asset: T) => string) {
	for (const { module } of await ImportFolder<T>("assets", folder)) {
		collection.set(keyOf(module), module);
	}
}

/**
 * Starts listening to every event in events/
 * An error in a handler is logged here, a rejected promise nobody catches can take the whole bot down
 */
async function LoadEvents() {
	for (const { module: event } of await ImportFolder<{ name: string; once?: boolean; execute: (...args: unknown[]) => unknown }>("events")) {
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
}

/**
 * The file that is the command: a folder is one command with subcommands and its main file is the command, a single file is a command by itself
 */
function FindCommandFile(commandsPath: string, entry: string): string | null {
	const entryPath = path.join(commandsPath, entry);
	if (!fs.statSync(entryPath).isDirectory()) return isScript(entry) ? entryPath : null;

	const mainFile = fs.readdirSync(entryPath).find((file) => /^main\.(ts|js)$/.test(file));
	return mainFile ? path.join(entryPath, mainFile) : null;
}

/** Loads the commands into the client, and returns what discord needs to know about them */
async function LoadCommands(): Promise<RESTPostAPIApplicationCommandsJSONBody[]> {
	const commandsPath = path.join(__dirname, "assets", "commands");
	const commandsData: RESTPostAPIApplicationCommandsJSONBody[] = [];

	for (const entry of fs.readdirSync(commandsPath)) {
		const commandFile = FindCommandFile(commandsPath, entry);
		if (!commandFile) continue;

		const { default: command } = await import(pathToFileURL(commandFile).href);
		client.commands.set(command.data.name, command);
		commandsData.push(command.data.toJSON());
	}

	return commandsData;
}

/** Tells discord which slash commands exist, a failure is only logged so the bot still starts with the commands it had */
async function RegisterSlashCommands(commandsData: RESTPostAPIApplicationCommandsJSONBody[]) {
	const rest = new REST({ version: "10" }).setToken(token);

	try {
		console.log("Started refreshing application (/) commands.");
		await rest.put(Routes.applicationCommands(clientId), { body: commandsData });
		console.log("Successfully reloaded application (/) commands.");
	} catch (error) {
		console.error("Error deploying commands:", error);
	}
}

/**
 * Runs a function every day at a clock time (like "03:30")
 * The next time is worked out again after every run, so it stays on the clock time when the clocks change
 */
function ScheduleDaily(clockTime: string, run: () => Promise<void>) {
	const [hours, minutes] = clockTime.split(":").map(Number);

	const scheduleNext = () => {
		const now = new Date();
		const nextRun = new Date();
		nextRun.setHours(hours, minutes, 0, 0);

		// a timer can fire a little early, so anything within a second counts as already passed
		if (nextRun.getTime() <= now.getTime() + 1000) nextRun.setDate(nextRun.getDate() + 1);

		setTimeout(async () => {
			await run();
			scheduleNext();
		}, nextRun.getTime() - now.getTime());
	};

	scheduleNext();
}

/**
 * Starts the tasks in assets/repeating, each one says when it runs (clockTime and/or an interval) and if it runs right away
 */
async function StartRepeatingTasks() {
	for (const { file, module: task } of await ImportFolder<Repeating>("assets", "repeating")) {
		const name = file.replace(/\.(ts|js)$/, "");
		RegisterTask(name);

		// one task failing must not stop the others or take the bot down
		const run = async () => {
			try {
				await task.execute(client);
				RecordTaskRun(name);
			} catch (error) {
				console.error(`[Error] Repeating task ${file}:`, SafeError(error));
				RecordTaskRun(name, error);
			}
		};

		const { clockTime, repeating, time, immediate } = task.data;
		if (clockTime) ScheduleDaily(clockTime, run);
		if (repeating && time) setInterval(run, time);
		if (immediate) await run();
	}
}

async function startBot() {
	const [servers] = await db.select({ count: sql<number>`count(*)` }).from(serverConfigTable);
	console.log(`Database connected, ${servers.count} configured server(s).`);

	await LoadEvents();
	const commandsData = await LoadCommands();
	await RegisterAssets(client.buttons, "buttons", (button) => button.data.customId);
	await RegisterAssets(client.selectMenus, "selectmenus", (selectMenu) => selectMenu.data.customId);
	await RegisterAssets(client.autocompletes, "autocompletes", (autocomplete) => autocomplete.data.name);
	await RegisterSlashCommands(commandsData);

	// logging in is the last step, the handlers are all in place before the first event arrives
	await client.login(token);
}

client.once("clientReady", () => {
	StartRepeatingTasks().catch((error) => console.error("Error starting the repeating tasks:", error));
});

// logs instead of crashing, the bot should keep running if one thing fails
client.on("error", (error) => console.error("[Error] Discord client:", error));
process.on("unhandledRejection", (reason) => console.error("[Error] Unhandled rejection:", SafeError(reason)));

startBot().catch(console.error);
