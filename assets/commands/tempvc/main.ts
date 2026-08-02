import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { AutocompleteInteraction, ChatInputCommandInteraction, Client } from "discord.js";
import { SlashCommandBuilder } from "discord.js";

import { builder as Option, autocomplete as optionAutocomplete } from "./options.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("tempvc")
		.setDescription("Manages your temporary voice channel")
        
        .addSubcommand(Option),
    async autocomplete(interaction: AutocompleteInteraction) {
		if (interaction.options.getSubcommand() === "options") {
			await optionAutocomplete(interaction, interaction.client);
		}
    },


	async execute(interaction: ChatInputCommandInteraction, client: Client) {
		if (!interaction.guild) {
			await interaction.reply("This command can only be used in a server.");
			return;
		}
		
		const subcommand = interaction.options.getSubcommand();

		const __dirname = path.dirname(fileURLToPath(import.meta.url));

		// Use the same extension as the current file (.ts during dev and .js after build)
		const currentExt = path.extname(fileURLToPath(import.meta.url)) || ".ts";
		const subPath = path.join(__dirname, subcommand + currentExt);

		try {
			const imported = await import(pathToFileURL(subPath).href);
			const handler = imported?.default;

			if (typeof handler !== "function") {
				await interaction.reply(`Unknown or invalid subcommand: ${subcommand}`);
				return;
			}

			await handler(interaction, client);
		} catch (err) {
			console.error("Failed to load subcommand handler:", err);
			await interaction.reply(`Error loading subcommand: ${subcommand}`);
		}
	},
};

export default command;
