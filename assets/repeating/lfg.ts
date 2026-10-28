import type { Client } from "discord.js";
import { RunLfgTick } from "../../utils/lfg.js";

const repeating: Repeating = {
	data: {
		immediate: false,
		repeating: true,
		time: 30 * 1000,
		clockTime: null,
	},
	async execute(client: Client) {
		await RunLfgTick(client);
	},
};

export default repeating;
