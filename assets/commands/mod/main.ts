import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ChatInputCommandInteraction, Client } from "discord.js";
import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import { builder as clearVerifyBuilder } from "./clearverify.js";
import { builder as manualVerifyBuilder } from "./manualverify.js";
import { builder as rulesBuilder } from "./rulesmessage.js";
import { builder as verifyBuilder } from "./verifymessage.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("mod")
		.setDescription("mod commands")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        .addSubcommand(clearVerifyBuilder)
		.addSubcommand(manualVerifyBuilder)
		.addSubcommand(rulesBuilder)
		.addSubcommand(verifyBuilder),

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
