import type { ChatInputCommandInteraction } from "discord.js";
import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import { RunSubcommand } from "../../../utils/subcommands.js";

import { builder as banBuilder } from "./ban.js";
import { builder as muteBuilder } from "./mute.js";
import { builder as purgeBuilder } from "./purge.js";
import { builder as slowmodeBuilder } from "./slowmode.js";
import { builder as unbanBuilder } from "./unban.js";
import { builder as unmuteBuilder } from "./unmute.js";
import { builder as warnBuilder } from "./warn.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("mod")
		.setDescription("moderation commands")
		.setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)

        .addSubcommand(banBuilder)
        .addSubcommand(muteBuilder)
        .addSubcommand(warnBuilder)
        .addSubcommand(unbanBuilder)
		.addSubcommand(unmuteBuilder)
		.addSubcommand(purgeBuilder)
		.addSubcommand(slowmodeBuilder),

	async execute(interaction: ChatInputCommandInteraction) {
		await RunSubcommand(import.meta.url, interaction);
	},
};

export default command;
