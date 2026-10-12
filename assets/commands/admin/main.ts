import type { ChatInputCommandInteraction } from "discord.js";
import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import { RunSubcommand } from "../../../utils/subcommands.js";

import { builder as clearVerifyBuilder } from "./verify/clearverify.js";
import { builder as lookupBuilder } from "./lookup.js";
import { builder as verifyBuilder } from "./verify.js";
import { builder as postBuilder } from "./post.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("admin")
		.setDescription("admin commands")
		.setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        .addSubcommand(clearVerifyBuilder)
		.addSubcommand(lookupBuilder)
		.addSubcommandGroup(postBuilder)
		.addSubcommandGroup(verifyBuilder),

	async execute(interaction: ChatInputCommandInteraction) {
		await RunSubcommand(import.meta.url, interaction);
	},
};

export default command;
