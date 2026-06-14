import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ChatInputCommandInteraction, Client } from "discord.js";
import { SlashCommandBuilder } from "discord.js";

import { FindAllNonNullKeys } from "../../../utils/profileManager.js";

import { builder as getBuilder } from "./get.js";
import { builder as listBuilder } from "./list.js";
import { builder as nextBuilder } from "./next.js";
import { builder as setBuilder } from "./set.js";

export const sortedList = async () => {
	const users = (await FindAllNonNullKeys("birthday")) as UserProfile[];

	if (users.length === 0) return null;

	const formattedList = users
		.map((user) => {
			const birthday = user.birthday as UserProfile["birthday"] | null;
			const birthdayDate = birthday ? new Date(birthday * 1000) : null;
			if (!birthdayDate) return { user, birthday: null };
			
			const birthdayDay = birthdayDate.getDate();
			const birthdayMonth = birthdayDate.getMonth() + 1;
			const birthdayYear = birthdayDate.getFullYear();
			return { user, birthday: { day: birthdayDay, month: birthdayMonth, year: birthdayYear } };
		})
		.sort((a, b) => {
			if (!a.birthday || !b.birthday) return 0;
			if (a.birthday.month !== b.birthday.month) {
				return a.birthday.month - b.birthday.month;
			}
			return a.birthday.day - b.birthday.day;
		});
	return formattedList;
};

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("birthday")
		.setDescription("Manage your birthday")
		.setDescriptionLocalizations({
			"sv-SE": "Hantera din födelsedag",
		})
		.addSubcommand(setBuilder)
		.addSubcommand(getBuilder)
		.addSubcommand(listBuilder)
		.addSubcommand(nextBuilder),

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
