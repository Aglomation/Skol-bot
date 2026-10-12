import type { ChatInputCommandInteraction } from "discord.js";
import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import { RunSubcommand } from "../../../utils/subcommands.js";

import { builder as banBuilder } from "./ban.js";
import { builder as muteBuilder } from "./mute.js";
import { builder as warnBuilder } from "./warn.js";
import { builder as unbanBuilder } from "./unban.js";
import { builder as unmuteBuilder } from "./unmute.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("mod")
		.setDescription("moderation commands")
		.setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)

        .addSubcommand(banBuilder)
        .addSubcommand(muteBuilder)
        .addSubcommand(warnBuilder)
        .addSubcommand(unbanBuilder)
        .addSubcommand(unmuteBuilder),

	async execute(interaction: ChatInputCommandInteraction) {
		await RunSubcommand(import.meta.url, interaction);
	},
};

export default command;
