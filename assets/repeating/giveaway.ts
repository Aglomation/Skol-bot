import type { Client } from "discord.js";
import { RunGiveawayTick } from "../../features/giveaway.js";

// ends the giveaways whose time is up, it also runs when the bot starts so the ones that ended while it was off are not forgotten
const repeating: Repeating = {
	data: {
		immediate: true,
		repeating: true,
		time: 15 * 1000,
		clockTime: null,
	},
	async execute(client: Client) {
		await RunGiveawayTick(client);
	},
};

export default repeating;
