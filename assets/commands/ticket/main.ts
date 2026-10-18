import type { ChatInputCommandInteraction } from "discord.js";
import { InteractionContextType, SlashCommandBuilder } from "discord.js";

import { RunSubcommand } from "../../../utils/subcommands.js";

import { builder as addBuilder } from "./add.js";
import { builder as closeBuilder } from "./close.js";
import { builder as removeBuilder } from "./remove.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("ticket")
		.setDescription("Manage the ticket you are in.")
		.setContexts(InteractionContextType.Guild)
		.addSubcommand(addBuilder)
		.addSubcommand(removeBuilder)
		.addSubcommand(closeBuilder),

	async execute(interaction: ChatInputCommandInteraction) {
		await RunSubcommand(import.meta.url, interaction);
	},
};

export default command;
