import type { Client, StringSelectMenuInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import { BuildStep, FinishVerify } from "../../utils/verifyFlow.js";

// The verify version of the menus, the custom id looks like verifyselect:<step>:<earlier answers>
// The answers so far travel in the custom id, so nothing is stored until the last question
const selectMenu: SelectMenu = {
	data: {
		customId: "verifyselect",
	},
	async execute(interaction: StringSelectMenuInteraction, _client: Client) {
		if (!interaction.guild) return;

		const [, step, ...state] = interaction.customId.split(":");
		const value = interaction.values[0];

		switch (step) {
			case "city":
				await interaction.update(BuildStep("class", [value], "verify"));
				break;
			case "class":
				await interaction.update(BuildStep("year", [...state, value], "verify"));
				break;
			case "year":
				await interaction.update(BuildStep("pronouns", [...state, value], "verify"));
				break;
			case "pronouns": {
				const [city, schoolClass, year] = state;
				await FinishVerify(interaction, city, schoolClass, year, interaction.values);
				break;
			}
			default:
				await interaction.reply({
					content: "Något gick fel, tryck på verifieringsknappen igen.",
					flags: MessageFlags.Ephemeral,
				});
		}
	},
};

export default selectMenu;
