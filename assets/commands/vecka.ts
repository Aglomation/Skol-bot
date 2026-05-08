import type { ChatInputCommandInteraction, Client } from "discord.js";
import { SlashCommandBuilder } from "discord.js";

export function getWeek(input: string | number): number {
    const inputDate = new Date(input); // Convert input string to Date object
    const inputYear = new Date(inputDate.getFullYear(), 0, 1); // Get January 1st of the same year
    const Since1st = Math.floor((inputDate.getTime() - inputYear.getTime()) / 86400000); // Calculate the days passed since January 1st (1000 * 60 * 60 * 24 = 86400000)
    const inputDay = inputYear.getDay();
    const so = (inputDay === 0) ? 6 : inputDay - 1;  // Adjust Sunday (0) to 6 (ISO starts Monday)
    const wn = Math.floor((Since1st + so) / 7) + 1;

    return wn;
}

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("week")
		.setDescription("vecka.nu clone"),

	async execute(interaction: ChatInputCommandInteraction, client: Client) {
        await interaction.reply({
            content: `Current week number: **${getWeek(new Date().getTime())}**`
        });
    }
};

export default command;
