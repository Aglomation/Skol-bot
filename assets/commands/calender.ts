import axios from "axios";
import type { ChatInputCommandInteraction, Client } from "discord.js";
import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { getWeek } from "./vecka.js";


const command: Command = {
	data: new SlashCommandBuilder()
		.setName("calender")
		.setDescription("Returns the current week number"),

	async execute(interaction: ChatInputCommandInteraction, client: Client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const holidays = await axios.get("https://api.dagsmart.se/holidays").then(async (response) => {
            // console.log(response.data)
            return response.data
        });
        // Klämmdagar
        const bridgedays = await axios.get("https://api.dagsmart.se/bridge-days").then(async (response) => {
            // console.log(response.data)
            return response.data
        });
    }
};

export default command;
