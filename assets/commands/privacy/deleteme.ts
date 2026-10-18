import type {
	ButtonInteraction,
    ChatInputCommandInteraction,
    SlashCommandSubcommandBuilder,
} from "discord.js";

import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    MessageFlags,
} from "discord.js";
import { GetServerConfig } from "../../../utils/configManager.js";
import { DeletePersonalData } from "../../../utils/profileManager.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
        .setName("deleteme")
        .setDescription("Request deletion of your data. This action is irreversible.");

export default async function command(
	interaction: ChatInputCommandInteraction,
) {
    if (!interaction.guild || !interaction.member) {
        await interaction.reply({
            content: "This command can only be used in a server.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

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
    
    await interaction.reply({
        content: "Are you sure you want to delete your data? This action is irreversible and will remove your access to the server.",
        flags: MessageFlags.Ephemeral,
        components: [row],
    });

    const message = await interaction.fetchReply();

    let buttonInteraction: ButtonInteraction;
    try {
        buttonInteraction = await message.awaitMessageComponent({
            componentType: ComponentType.Button,
            time: 30000,
            filter: (i) => i.user.id === interaction.user.id,
        });
    } catch {
        await interaction.editReply({
            content: "Confirmation timed out.",
            components: [],
        });
        return;
    }

        if (buttonInteraction.customId !== "privacy_deleteme_confirm") {
            await buttonInteraction.update({
                content: "Deletion request canceled.",
                components: [],
            });
            return;
        }
        
    // answering the button itself, otherwise discord shows "This interaction failed"
    await buttonInteraction.update({
            content: "Attempting to delete your data. This may take a moment...",
            components: [],
        });

    try {
        // the access is removed first, if that fails nothing has been deleted yet
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        // the teacher role came from the email.
        const roleIds = [
            await GetServerConfig(interaction.guild.id, "verifiedRoleId"),
            await GetServerConfig(interaction.guild.id, "teacherRoleId"),
        ].filter((id): id is string => !!id && !!member?.roles.cache.has(id));
        if (member && roleIds.length > 0) {
            await member.roles.remove(roleIds);
        }

        // moderation history is kept as the privacy policy allows, a full delete needs an admin
        const keptHistory = await DeletePersonalData(interaction.user.id, interaction.guild.id);

        await interaction.editReply({
            content: "Deletion request completed. Your data has been deleted and your access to the server has been revoked." +
                (keptHistory ? "\nYour moderation history is kept as described in the privacy policy, contact an admin if you want it removed." : ""),
            components: [],
        });
    } catch (error) {
        console.error("Error occurred while handling deletion request:", error);
        await interaction.editReply({
            content: "Something went wrong while deleting your data, please try again or contact an admin.",
            components: [],
        });
    }
        }
