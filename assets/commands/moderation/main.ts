import type { ChatInputCommandInteraction } from "discord.js";
import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import { RunSubcommand } from "../../../utils/subcommands.js";

import { builder as activeBuilder } from "./active.js";
import { builder as bansBuilder } from "./bans.js";
import { builder as historyBuilder } from "./history.js";
import { builder as noteBuilder } from "./note.js";
import { builder as recentBuilder } from "./recent.js";
import { builder as statsBuilder } from "./citystats.js";
import { builder as voidBuilder } from "./void.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("moderation")
		.setDescription("Look at and manage the moderation history")
		.setContexts(InteractionContextType.Guild)
		.setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)

		.addSubcommand(historyBuilder)
		.addSubcommand(recentBuilder)
		.addSubcommand(bansBuilder)
		.addSubcommand(activeBuilder)
		.addSubcommand(noteBuilder)
		.addSubcommand(voidBuilder)
		.addSubcommand(statsBuilder),

	async execute(interaction: ChatInputCommandInteraction,) {
		await RunSubcommand(import.meta.url, interaction);
	},
};

export default command;
