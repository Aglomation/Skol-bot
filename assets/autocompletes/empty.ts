import type { AutocompleteInteraction } from "discord.js";

const autocomplete: Autocomplete = {
	data: {
		name: "empty",
	},
	async execute(
		interaction: AutocompleteInteraction,
	): Promise<void> {
        await interaction.respond([]);
	},
};

export default autocomplete;
