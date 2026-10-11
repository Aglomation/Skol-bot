import type { ButtonInteraction, Client } from "discord.js";
import { FinishVerify } from "../../utils/verifyFlow.js";

// The "Hoppa över" button under the pronoun question, the custom id is verifyskip:<city>:<class>:<year>
const button: Button = {
	data: {
		customId: "verifyskip",
	},
	async execute(interaction: ButtonInteraction, _client: Client) {
		const [, city, schoolClass, year] = interaction.customId.split(":");

		await FinishVerify(interaction, city, schoolClass, year, []);
	},
};

export default button;
