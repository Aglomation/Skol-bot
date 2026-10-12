import type { ChatInputCommandInteraction } from "discord.js";
import { InteractionContextType, SlashCommandBuilder } from "discord.js";

import { RunSubcommand } from "../../../utils/subcommands.js";

import { builder as clearBuilder } from "./clear.js";
import { builder as getBuilder } from "./get.js";
import { builder as listBuilder } from "./list.js";
import { builder as nextBuilder } from "./next.js";
import { builder as setBuilder } from "./set.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("birthday")
		.setDescription("Manage your birthday")
		.setDescriptionLocalizations({
			"sv-SE": "Hantera din födelsedag",
		})
		.setContexts(InteractionContextType.Guild)
		.addSubcommand(setBuilder)
		.addSubcommand(clearBuilder)
		.addSubcommand(getBuilder)
		.addSubcommand(listBuilder)
		.addSubcommand(nextBuilder),

	async execute(interaction: ChatInputCommandInteraction) {
		await RunSubcommand(import.meta.url, interaction);
	},
};

export default command;
