import type { ChatInputCommandInteraction } from "discord.js";
import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import { RunSubcommand } from "../../../utils/subcommands.js";

import { builder as lookupBuilder } from "./lookup.js";
import { builder as postBuilder } from "./post.js";
import { builder as statusBuilder } from "./status.js";
import { builder as verifyBuilder } from "./verify.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("admin")
		.setDescription("admin commands")
		.setContexts(InteractionContextType.Guild)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

		.addSubcommand(lookupBuilder)
		.addSubcommand(statusBuilder)
		.addSubcommandGroup(postBuilder)
		.addSubcommandGroup(verifyBuilder),

	async execute(interaction: ChatInputCommandInteraction) {
		await RunSubcommand(import.meta.url, interaction);
	},
};

export default command;
