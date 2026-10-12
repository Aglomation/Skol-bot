import type { ChatInputCommandInteraction } from "discord.js";
import { SlashCommandBuilder } from "discord.js";

/**
 * The ISO 8601 week number (what vecka.nu shows), for the date in Sweden and not wherever the server is
 * Week 1 is the week with the first thursday of the year, so the first days of January can be week 52/53
 */
export function getWeek(input: string | number | Date = Date.now()): number {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: "Europe/Stockholm",
		year: "numeric",
		month: "numeric",
		day: "numeric",
	}).formatToParts(new Date(input));
	const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);

	const date = new Date(Date.UTC(part("year"), part("month") - 1, part("day")));

	// move to the thursday of this week (monday is 1, sunday is 7), the week belongs to the year of that thursday
	date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));

	const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
	return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("week")
		.setDescription("vecka.nu clone"),

	async execute(interaction: ChatInputCommandInteraction) {
		await interaction.reply({
			content: `Current week number: **${getWeek(Date.now())}**`,
		});
	},
};

export default command;
