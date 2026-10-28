import type { AutocompleteInteraction, ChatInputCommandInteraction } from "discord.js";
import { InteractionContextType, SlashCommandBuilder } from "discord.js";
import { GetGameSuggestions } from "../../../utils/lfg.js";
import { RunSubcommand } from "../../../utils/subcommands.js";
import { builder as createBuilder } from "./create.js";
import { builder as listBuilder } from "./list.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("lfg")
		.setDescription("Find people to play with")
		.setContexts(InteractionContextType.Guild)
		.addSubcommand(createBuilder)
		.addSubcommand(listBuilder),

	async autocomplete(interaction: AutocompleteInteraction) {
		const focused = interaction.options.getFocused(true);
		if (focused.name !== "game" || !interaction.guildId) {
			await interaction.respond([]);
			return;
		}

		const games = await GetGameSuggestions(interaction.guildId, focused.value);
		await interaction.respond(games.map((game) => ({ name: game, value: game })));
	},

	async execute(interaction: ChatInputCommandInteraction) {
		await RunSubcommand(import.meta.url, interaction);
	},
};

export default command;
