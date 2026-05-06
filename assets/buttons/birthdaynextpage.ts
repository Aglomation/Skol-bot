import type { ButtonInteraction, Client } from "discord.js";
import { generateBirthdayPage } from "../commands/birthday.js";

const button: Button = {
    data: {
        customId: "birthdaychangepage"
    },
    async execute(interaction: ButtonInteraction, _client: Client): Promise<void> {
        const page = parseInt(interaction.customId.split(":")[1], 10) || 1;
        
        const pageData = await generateBirthdayPage(page, interaction.guild);

        if (!pageData) {
            await interaction.update({ content: "No birthdays found.", embeds: [], components: [] });
            return;
        }
        
        await interaction.update(pageData);
    },
};

export default button;
