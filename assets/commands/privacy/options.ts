import type{
    ChatInputCommandInteraction,
    SlashCommandSubcommandBuilder,
} from "discord.js";

import { MessageFlags } from "discord.js";

import { PRIVACY_PREFERENCE } from "../../../utils/privacyOptions.js";
import { PROFILE_FAILED, UpdateProfile } from "../../../utils/profileManager.js";

const privacyChoices = [
    { name: "Keep everything", value: PRIVACY_PREFERENCE.KEEP_ALL },
    { name: "Delete all optionally added data, birthday etc (Default)", value: PRIVACY_PREFERENCE.DELETE_OPTIONAL },
    // the moderation history stays, so a ban still counts if you come back
    { name: "Delete everything except the moderation history, you have to verify again if you rejoin", value: PRIVACY_PREFERENCE.DELETE_ALL },
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

    const saved = await UpdateProfile(interaction.user.id, interaction.guild.id, { privacyOption: optionValue });
    if (saved === PROFILE_FAILED) {
        await interaction.reply({
            content: "I couldn't save your preference, try again later.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.reply({
        content: `Your privacy preference has been updated to: **${selectedChoiceName}**`,
        flags: MessageFlags.Ephemeral,
    });
};