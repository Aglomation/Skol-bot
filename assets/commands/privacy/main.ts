import type { ChatInputCommandInteraction } from "discord.js";
import { InteractionContextType, SlashCommandBuilder } from "discord.js";

import { RunSubcommand } from "../../../utils/subcommands.js";

import { builder as DeleteMe } from "./deleteme.js";
import { builder as myData } from "./mydata.js";
import { builder as Option } from "./options.js";
import { builder as Policy } from "./policy.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("privacy")
		.setDescription("Handles your privacy preferences")
		.setContexts(InteractionContextType.Guild)
		.addSubcommand(Policy)
        .addSubcommand(Option)
        .addSubcommand(DeleteMe)
        .addSubcommand(myData),

	async execute(interaction: ChatInputCommandInteraction) {
		await RunSubcommand(import.meta.url, interaction);
	},
};

export default command;
