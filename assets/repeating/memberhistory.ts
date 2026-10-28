import type { Client } from "discord.js";
import { RecordSnapshot } from "../../utils/memberHistory.js";

const repeating: Repeating = {
	data: {
		immediate: true,
		repeating: true,
		time: null,
		clockTime: "00:10",
	},
	async execute(client: Client) {
		for (const guild of client.guilds.cache.values()) {
			try {
				await RecordSnapshot(guild);
			} catch (error) {
				console.error(`Could not save the member history of ${guild.id}:`, error);
			}
		}
	},
};

export default repeating;
