import type {
    ButtonInteraction,
    ChatInputCommandInteraction,
    Guild,
    SlashCommandSubcommandBuilder,
} from "discord.js";

import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    MessageFlags,
} from "discord.js";
import { RemoveUserFromGiveaways } from "../../../features/giveaway.js";
import { RemoveUserFromLfg } from "../../../features/lfg.js";
import { GetServerConfig } from "../../../utils/configManager.js";
import { DeletePersonalData } from "../../../utils/profileManager.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
        .setName("deleteme")
        .setDescription("Request deletion of your data. This action is irreversible");

const CONFIRM_ID = "privacy_deleteme_confirm";
const CANCEL_ID = "privacy_deleteme_cancel";
const CONFIRMATION_TIMEOUT_MS = 30000;

/**
 * Asks "are you sure" with a confirm and a cancel button
 * @returns The press of the confirm button (still to be answered), null if they cancelled or didn't answer in time
 */
async function AskForConfirmation(interaction: ChatInputCommandInteraction): Promise<ButtonInteraction | null> {
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(CONFIRM_ID).setLabel("Confirm deletion").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(CANCEL_ID).setLabel("Cancel").setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({
        content: "Are you sure you want to delete your data? This action is irreversible and will remove your access to the server.",
        flags: MessageFlags.Ephemeral,
        components: [buttons],
    });
    const question = await interaction.fetchReply();

    let pressed: ButtonInteraction;
    try {
        pressed = await question.awaitMessageComponent({
            componentType: ComponentType.Button,
            time: CONFIRMATION_TIMEOUT_MS,
            filter: (press) => press.user.id === interaction.user.id,
        });
    } catch {
        await interaction.editReply({ content: "Confirmation timed out.", components: [] });
        return null;
    }

    if (pressed.customId !== CONFIRM_ID) {
        await pressed.update({ content: "Deletion request canceled.", components: [] });
        return null;
    }

    return pressed;
}

/** Takes away the verified role, deletes what the bot has saved about the member, and tells them what is left */
async function DeleteMemberData(interaction: ChatInputCommandInteraction, guild: Guild) {
    const userId = interaction.user.id;

    try {
        // the access is removed first, if that fails nothing has been deleted yet
        const member = await guild.members.fetch(userId).catch(() => null);
        // the teacher role came from the email, so it goes too
        const roleIds = [await GetServerConfig(guild.id, "verifiedRoleId"), await GetServerConfig(guild.id, "teacherRoleId")].filter(
            (id): id is string => !!id && !!member?.roles.cache.has(id),
        );
        if (member && roleIds.length > 0) {
            await member.roles.remove(roleIds);
        }

        // moderation history is kept as the privacy policy allows, a full delete needs an admin
        const keptHistory = await DeletePersonalData(userId, guild.id);
        await RemoveUserFromLfg(interaction.client, guild.id, userId);
        await RemoveUserFromGiveaways(guild.id, userId);

        await interaction.editReply({
            content:
                "Deletion request completed. Your data has been deleted and your access to the server has been revoked." +
                (keptHistory ? "\nYour moderation history is kept as described in the privacy policy, contact an admin if you want it removed." : "") +
                "\nTickets and the staff's log channels are not cleared automatically, contact an admin if you want that.",
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

export default async function command(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.member) {
        await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
        return;
    }

    const confirmation = await AskForConfirmation(interaction);
    if (!confirmation) return;

    // answering the button itself, otherwise discord shows "This interaction failed"
    await confirmation.update({ content: "Attempting to delete your data. This may take a moment...", components: [] });

    await DeleteMemberData(interaction, interaction.guild);
}
