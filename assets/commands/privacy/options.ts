import type{
    ChatInputCommandInteraction,
    Client,
    SlashCommandSubcommandBuilder,
} from "discord.js";

import { MessageFlags } from "discord.js";

import { UpdateProfile } from "../../../utils/profileManager.js";

const privacyChoices = [
    { name: "Keep everything", value: 1 },
    { name: "Delete all optionally added data, birthday etc (Default)", value: 2 },
    { name: "Delete everything, rejoining will be impossible", value: 3 },
];

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
        .setName("options")
        .setDescription("How your data is handled after you leave the server")
        .addIntegerOption((option) =>
            option
                .setName("option")
                .setDescription("What to do with your data after you leave the server")
                .setRequired(true)
                .setChoices(...privacyChoices)
        );

export default async function command(
	interaction: ChatInputCommandInteraction,
	_client: Client,
) {
    if (!interaction.guild) {
        await interaction.reply({
            content: "This command can only be used in a server.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    
    const optionValue = interaction.options.getInteger("option", true);
    const selectedChoiceName = privacyChoices.find(c => c.value === optionValue)?.name;

    await UpdateProfile(interaction.user.id, interaction.guild.id, { privacyOption: optionValue });

    await interaction.reply({
        content: `Your privacy preference has been updated to: **${selectedChoiceName}**`,
        flags: MessageFlags.Ephemeral,
    });
};