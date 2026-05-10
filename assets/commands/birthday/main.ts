import type { ChatInputCommandInteraction, Client } from "discord.js";
import { SlashCommandBuilder } from "discord.js";

import { FindAllNonNullKeys } from "../../../utils/profileManager.js";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const sortedList = async () => {
	const users = (await FindAllNonNullKeys("birthday")) as UserProfile[];

	if (users.length === 0) return null;

	const formattedList = users
		.map((user) => {
			const birthday = user.birthday as UserProfile["birthday"] | null;
			return { user, birthday };
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
		.addSubcommand((subcommand) =>
			subcommand
				.setName("set")
				.setDescription("Sets your birthday")
				.setDescriptionLocalizations({
					"sv-SE": "Ändrar din födelsedag",
				})
				.addStringOption((option) =>
					option
						.setName("date")
						.setDescription("Your birthday (YYYY-MM-DD)")
						.setDescriptionLocalizations({
							"sv-SE": "Din födelsedag (ÅÅÅÅ-MM-DD)",
						})
						.setRequired(false),
				)
				.addUserOption((option) =>
					option
						.setName("user")
						.setDescription(
							"(Moderator option) to set birthday for another user",
						)
						.setRequired(false),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("get")
				.setDescription("Gets your birthday")
				.setDescriptionLocalizations({
					"sv-SE": "Hämtar din födelsedag",
				})
				.addUserOption((option) =>
					option
						.setName("user")
						.setDescription("Get birthday for another user")
						.setRequired(false),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("list")
				.setDescription("Shows all birthdays")
				.setDescriptionLocalizations({
					"sv-SE": "Visar alla födelsedagar",
				}),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("next")
				.setDescription("Shows the next birthday")
				.setDescriptionLocalizations({
					"sv-SE": "Visar nästa födelsedag",
				}),
		),

	async execute(interaction: ChatInputCommandInteraction, client: Client) {
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
