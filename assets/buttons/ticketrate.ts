import type { ButtonInteraction } from "discord.js";
import { SendLog } from "../../utils/logChannel.js";
import { TICKET_RATING_ID } from "../../utils/tickets.js";

const button: Button = {
	data: {
		customId: TICKET_RATING_ID,
	},
	async execute(interaction: ButtonInteraction) {
		const [, guildId, stars, claimerId] = interaction.customId.split(":");
		const rating = Number(stars);

		if (!guildId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
			await interaction.update({ content: "That rating didn't work.", components: [] });
			return;
		}

		await interaction.update({ content: `Thanks for your rating, ${"⭐".repeat(rating)}`, components: [] });

		const handledBy = claimerId && claimerId !== "0" ? ` for the help of <@${claimerId}>` : "";
		await SendLog(interaction.client, guildId, `⭐ <@${interaction.user.id}> rated a ticket ${rating}/5${handledBy}.`);
	},
};

export default button;
