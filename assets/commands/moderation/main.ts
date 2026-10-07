import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ChatInputCommandInteraction, Client } from "discord.js";
import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import { builder as activeBuilder } from "./active.js";
import { builder as bansBuilder } from "./bans.js";
import { builder as historyBuilder } from "./history.js";
import { builder as noteBuilder } from "./note.js";
import { builder as recentBuilder } from "./recent.js";
import { builder as statsBuilder } from "./stats.js";
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

	async execute(interaction: ChatInputCommandInteraction, client: Client) {
		if (!interaction.guild) {
			await interaction.reply("This command can only be used in a server.");
			return;
		}

		const subcommand = interaction.options.getSubcommand();

		const __dirname = path.dirname(fileURLToPath(import.meta.url));

		// Use the same extension as the current file (.ts during dev and .js after build)
		const currentExt = path.extname(fileURLToPath(import.meta.url)) || ".ts";
		const subPath = path.join(__dirname, subcommand + currentExt);

		try {
			const imported = await import(pathToFileURL(subPath).href);
			const handler = imported?.default;

			if (typeof handler !== "function") {
				await interaction.reply(`Unknown or invalid subcommand: ${subcommand}`);
				return;
			}

			await handler(interaction, client);
		} catch (err) {
			console.error("Failed to load subcommand handler:", err);
			await interaction.reply(`Error loading subcommand: ${subcommand}`);
		}
	},
};

export default command;
