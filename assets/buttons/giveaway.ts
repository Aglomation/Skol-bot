import type { ButtonInteraction, GuildMember } from "discord.js";
import { MessageFlags } from "discord.js";
import { BuildGiveawayMessage, GetGiveaways, GIVEAWAY_BUTTON_ID, ToggleGiveawayEntry } from "../../features/giveaway.js";

// the button of a giveaway that is entered with a button, the giveaway is found from the message the button is on
const button: Button = {
	data: {
		customId: GIVEAWAY_BUTTON_ID,
	},
	async execute(interaction: ButtonInteraction) {
		const giveaway = interaction.guildId ? (await GetGiveaways(interaction.guildId)).find((item) => item.messageId === interaction.message.id) : null;
		if (!giveaway || !interaction.member) {
			await interaction.reply({ content: "This giveaway isn't running anymore.", flags: MessageFlags.Ephemeral });
			return;
		}

		const result = await ToggleGiveawayEntry(giveaway, interaction.member as GuildMember);
		if (result.state === "blocked") {
			await interaction.reply({ content: result.reason, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
			return;
		}

		// the new number is on the button for everyone, and the person who pressed it is told what happened
		await interaction.update(BuildGiveawayMessage(giveaway));
		await interaction.followUp({
			content: result.state === "entered" ? "🎉 You're in! Press the button again if you want to leave." : "You left the giveaway.",
			flags: MessageFlags.Ephemeral,
		});
	},
};

export default button;
