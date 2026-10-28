import type { ChatInputCommandInteraction } from "discord.js";
import { InteractionContextType, SlashCommandBuilder } from "discord.js";

import { RunSubcommand } from "../../../utils/subcommands.js";

import { builder as allBuilder } from "./all.js";
import { builder as colorBuilder } from "./color.js";
import { builder as pronounsBuilder } from "./pronouns.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("roles")
		.setDescription("Change your pronouns, city, class and year roles")
		.setDescriptionLocalization("en-US", "Change your pronouns, city, class and year roles")
		.setDescriptionLocalization("sv-SE", "Ändra dina pronomen, stad, klass och årsroller")
		.setContexts(InteractionContextType.Guild)

		.addSubcommand(allBuilder)
		.addSubcommand(pronounsBuilder)
		.addSubcommand(colorBuilder),

	async execute(interaction: ChatInputCommandInteraction) {
		await RunSubcommand(import.meta.url, interaction);
	},
};

export default command;
