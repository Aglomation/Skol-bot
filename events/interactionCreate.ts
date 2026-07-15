import type { Client, Interaction } from "discord.js";
import { Events } from "discord.js";

export default {
	name: Events.InteractionCreate,
	once: false,
	async execute(interaction: Interaction, client: Client) {
		if (interaction.isChatInputCommand()) {
			const command = client.commands.get(interaction.commandName);
			if (!command) return;

			try {
				await command.execute(interaction, client);
			} catch (error) {
				console.error(error);
			}
		} else if (interaction.isAutocomplete()) {
			const standaloneAutocomplete = client.autocompletes.get(interaction.commandName);
			
			if (standaloneAutocomplete) {
				try {
					await standaloneAutocomplete.execute(interaction, client);
				} catch (error) {
					console.error(error);
				}
				return;
			}

			// Look in the commands file too
			const command = client.commands.get(interaction.commandName);
			if (!command) return;

			if (typeof command.autocomplete === "function") {
				try {
					await command.autocomplete(interaction, client);
				} catch (error) {
					console.error(error);
				}
			}
		} else if (interaction.isButton()) {
			const buttonCommand = client.buttons.get(
				interaction.customId.includes(":")
					? interaction.customId.split(":")[0]
					: interaction.customId,
			);
			if (!buttonCommand) return;
			try {
				await buttonCommand.execute(interaction, client);
			} catch (error) {
				console.error(error);
			}
		}
	},
};
