import type { AutocompleteInteraction, Client } from "discord.js";

const autocomplete: Autocomplete = {
	data: {
		name: "empty",
	},
	async execute(
		interaction: AutocompleteInteraction,
		_client: Client,
	): Promise<void> {
        await interaction.respond([]);
	},
};

export default autocomplete;
