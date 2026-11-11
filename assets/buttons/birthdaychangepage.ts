import type { ButtonInteraction } from "discord.js";
import { GenerateBirthdayPage } from "../../features/birthdayList.js";

const button: Button = {
	data: {
		customId: "birthdaychangepage",
	},
	async execute(
		interaction: ButtonInteraction,
	): Promise<void> {
		const page = parseInt(interaction.customId.split(":")[1], 10) || 1;

		const pageData = await GenerateBirthdayPage(interaction.guild, page);

		if (!pageData) {
			await interaction.update({
				content: "No birthdays found.",
				embeds: [],
				components: [],
			});
			return;
		}

		await interaction.update(pageData);
	},
};

export default button;
