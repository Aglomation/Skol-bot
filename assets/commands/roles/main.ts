import type { ChatInputCommandInteraction } from "discord.js";
import { InteractionContextType, SlashCommandBuilder } from "discord.js";

import { RunSubcommand } from "../../../utils/subcommands.js";

import { builder as allBuilder } from "./all.js";
import { builder as pronounsBuilder } from "./pronouns.js";
import { builder as colorBuilder } from "./color.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("roles")
		.setDescription("Change your pronouns, city, class and year roles")
		.setContexts(InteractionContextType.Guild)

		.addSubcommand(allBuilder)
		.addSubcommand(pronounsBuilder)
		.addSubcommand(colorBuilder),

	async execute(interaction: ChatInputCommandInteraction) {
		await RunSubcommand(import.meta.url, interaction);
	},
};

export default command;
