import type { ButtonInteraction, Client } from "discord.js";
import { FinishRoles, SetPronouns } from "../../utils/verifyFlow.js";

// The button under the pronoun question in /roles
// rolesskip:clear removes the pronouns, rolesskip:<city>:<class>:<year> skips the question in /roles all
const button: Button = {
	data: {
		customId: "rolesskip",
	},
	async execute(interaction: ButtonInteraction, _client: Client) {
		const [, city, schoolClass, year] = interaction.customId.split(":");

		if (city === "clear") {
			await SetPronouns(interaction, []);
			return;
		}

		await FinishRoles(interaction, city, schoolClass, year, []);
	},
};

export default button;
