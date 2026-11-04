import type { Client } from "discord.js";
import { Events } from "discord.js";
import { SweepTempChannels } from "../features/tempVoice.js";

export default {
	name: Events.ClientReady,
	once: true,
	async execute(client: Client) {
		console.log(`Logged in as ${client.user?.tag}!`);
		await SweepTempChannels(client);
	},
};
