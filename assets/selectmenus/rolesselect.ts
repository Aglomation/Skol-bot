import type { Client, StringSelectMenuInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import { BuildStep, FinishRoles, SetPronouns } from "../../utils/verifyFlow.js";

// The /roles version of the verify menus, the custom id looks like rolesselect:<step>:<earlier answers>
const selectMenu: SelectMenu = {
	data: {
		customId: "rolesselect",
	},
	async execute(interaction: StringSelectMenuInteraction, _client: Client) {
		if (!interaction.guild) return;

		const [, step, ...state] = interaction.customId.split(":");
		const value = interaction.values[0];

		switch (step) {
			case "city":
				await interaction.update(BuildStep("class", [value], "roles"));
				break;
			case "class":
				await interaction.update(BuildStep("year", [...state, value], "roles"));
				break;
			case "year":
				await interaction.update(BuildStep("pronouns", [...state, value], "roles"));
				break;
			case "pronouns": {
				// no earlier answers means it came from /roles pronouns
				if (state.length === 0) {
					await SetPronouns(interaction, interaction.values);
					break;
				}
				const [city, schoolClass, year] = state;
				await FinishRoles(interaction, city, schoolClass, year, interaction.values);
				break;
			}
			default:
				await interaction.reply({
					content: "Något gick fel, kör kommandot igen.",
					flags: MessageFlags.Ephemeral,
				});
		}
	},
};

export default selectMenu;
