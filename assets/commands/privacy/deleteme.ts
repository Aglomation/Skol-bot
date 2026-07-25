import type {
    ChatInputCommandInteraction,
    Client,
    SlashCommandSubcommandBuilder,
} from "discord.js";

import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    MessageFlags,
} from "discord.js";
import { DeleteProfile } from "../../../utils/profileManager.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
        .setName("deleteme")
        .setDescription("Request deletion of your data. This action is irreversible.");

export default async function command(
	interaction: ChatInputCommandInteraction,
	_client: Client,
) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId("privacy_deleteme_confirm")
            .setLabel("Confirm deletion")
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId("privacy_deleteme_cancel")
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Secondary),
    );
    
    if (!interaction.guild || !interaction.member) {
        await interaction.reply({
            content: "This command can only be used in a server.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.reply({
        content: "Are you sure you want to delete your data? This action is irreversible and will remove your access to the server.",
        flags: MessageFlags.Ephemeral,
        components: [row]
    });

    const message = await interaction.fetchReply();
    try {
        const buttonInteraction = await message.awaitMessageComponent({
            componentType: ComponentType.Button,
            time: 30000,
            filter: (i) => i.user.id === interaction.user.id,
        });

        if (buttonInteraction.customId !== "privacy_deleteme_confirm") {
            await buttonInteraction.update({
                content: "Deletion request canceled.",
                components: [],
            });
            return;
        }
        

        await interaction.editReply({
            content: "Attempting to delete your data. This may take a moment...",
            components: [],
        });

        
        const member = interaction.guild?.members.cache.get(interaction.user.id);
        if (!member) return;

        await DeleteProfile(interaction.user.id, interaction.guild.id);

        await interaction.editReply({
            content: "Deletion request completed. Your data has been deleted and your access to the server will now be revoked.",
            components: [],
        });

        const verifiedRole = interaction.guild?.roles.cache.get(
            "1498832228145168514",
        );
        if (verifiedRole) {
            await member.roles.remove(verifiedRole);
        }

        
    } catch(error) {
        console.error("Error occurred while handling deletion request:", error);
        await interaction.editReply({
            content: "Confirmation timed out.",
            components: [],
        });
    };
};