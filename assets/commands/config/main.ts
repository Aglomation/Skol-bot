import type { ChatInputCommandInteraction } from "discord.js";
import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import { RunSubcommand } from "../../../utils/subcommands.js";

import { builder as clearBuilder } from "./clear.js";
import { builder as setBuilder } from "./set.js";
import { builder as viewBuilder } from "./view.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("config")
		.setDescription("Change the server settings the bot uses")
		.setContexts(InteractionContextType.Guild)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

		.addSubcommand(setBuilder)
		.addSubcommand(clearBuilder)
		.addSubcommand(viewBuilder),

	async execute(interaction: ChatInputCommandInteraction) {
		await RunSubcommand(import.meta.url, interaction);
	},
};

export default command;
