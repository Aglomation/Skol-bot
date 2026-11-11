import type { AutocompleteInteraction, ChatInputCommandInteraction } from "discord.js";
import { InteractionContextType, SlashCommandBuilder } from "discord.js";
import { GetGiveawayChoices } from "../../../features/giveaway.js";
import { RunSubcommand } from "../../../utils/subcommands.js";
import { builder as cancelBuilder } from "./cancel.js";
import { builder as endBuilder } from "./end.js";
import { builder as extendBuilder } from "./extend.js";
import { builder as listBuilder } from "./list.js";
import { builder as rerollBuilder } from "./reroll.js";
import { builder as startBuilder } from "./start.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("giveaway")
		.setDescription("Run giveaways, people enter by pressing a button")
		.setContexts(InteractionContextType.Guild)
		.addSubcommand(startBuilder)
		.addSubcommand(endBuilder)
		.addSubcommand(extendBuilder)
		.addSubcommand(rerollBuilder)
		.addSubcommand(cancelBuilder)
		.addSubcommand(listBuilder),

	// the giveaway option of end, reroll and cancel is picked from a list, reroll looks at the ones that ended and the others at the running ones
	async autocomplete(interaction: AutocompleteInteraction) {
		const focused = interaction.options.getFocused(true);
		if (focused.name !== "giveaway" || !interaction.guildId) {
			await interaction.respond([]);
			return;
		}

		const kind = interaction.options.getSubcommand() === "reroll" ? "ended" : "active";
		await interaction.respond(await GetGiveawayChoices(interaction.guildId, kind, focused.value));
	},

	async execute(interaction: ChatInputCommandInteraction) {
		await RunSubcommand(import.meta.url, interaction);
	},
};

export default command;
