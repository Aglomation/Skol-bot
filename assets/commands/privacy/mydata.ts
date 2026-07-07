import type {
    ChatInputCommandInteraction,
    Client,
    SlashCommandSubcommandBuilder,
} from "discord.js";

import { MessageFlags } from "discord.js";
import { GetProfile } from "../../../utils/profileManager.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
        .setName("mydata")
        .setDescription("View your saved data.")


export default async function command(
	interaction: ChatInputCommandInteraction,
	_client: Client,
) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const userId = interaction.user.id;
    const profile = await GetProfile(userId);

    if (!profile) {
        await interaction.editReply({
            content: "No data found for your user ID.",
        });
        return;
    }

    await interaction.editReply({
        content: `Your raw data:\n\`\`\`json\n${JSON.stringify(profile, null, 2)}\n\`\`\``,
    });
}