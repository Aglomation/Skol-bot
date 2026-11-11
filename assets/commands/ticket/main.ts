import type { ChatInputCommandInteraction } from "discord.js";
import { InteractionContextType, SlashCommandBuilder } from "discord.js";

import { RunSubcommand } from "../../../utils/subcommands.js";

import { builder as addBuilder } from "./add.js";
import { builder as claimBuilder } from "./claim.js";
import { builder as closeBuilder } from "./close.js";
import { builder as infoBuilder } from "./info.js";
import { builder as openBuilder } from "./open.js";
import { builder as removeBuilder } from "./remove.js";
import { builder as renameBuilder } from "./rename.js";
import { builder as transcriptBuilder } from "./transcript.js";
import { builder as unclaimBuilder } from "./unclaim.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("ticket")
		.setDescription("Manage the ticket you are in")
		.setContexts(InteractionContextType.Guild)
		.addSubcommand(addBuilder)
		.addSubcommand(removeBuilder)
		.addSubcommand(renameBuilder)
		.addSubcommand(closeBuilder)
		.addSubcommand(openBuilder)
		.addSubcommand(infoBuilder)
		.addSubcommand(claimBuilder)
		.addSubcommand(unclaimBuilder)
		.addSubcommand(transcriptBuilder),

	async execute(interaction: ChatInputCommandInteraction) {
		await RunSubcommand(import.meta.url, interaction);
	},
};

export default command;
