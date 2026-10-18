import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Colors,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
} from "discord.js";
import { GetServerConfig } from "../../../../utils/configManager.js";
import { HasPermission } from "../../../../utils/permissions.js";
import { TICKET_BUTTON_ID } from "../../../../utils/tickets.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
		.setName('ticket')
        .setDescription('Posts the ticket button into the current channel.');

export default async function command(
	interaction: ChatInputCommandInteraction,
) {
    if (!interaction.guild) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	if (!(await HasPermission(interaction, PermissionFlagsBits.BanMembers))) return;

    const channel = interaction.channel;
    if (!channel?.isTextBased() || channel.isDMBased()) {
        await interaction.editReply("This command must be run in a server text channel.");
        return;
    }
    
    const botMember = interaction.guild.members.me;
    if (!botMember || !channel.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages)) {
        await interaction.editReply("I don't have permission to send messages in this channel.");
        return;
    }

    // a button that makes tickets in a category that isn't set would only give errors
    const categoryId = await GetServerConfig(interaction.guild.id, "ticketCategory");
    if (!categoryId) {
        await interaction.editReply("Set the ticket category first with `/config set ticket_category`.");
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle("🎫 Need help?")
        .setColor(Colors.Blurple)
        .setDescription(
            "Press the button below to open a ticket. It is a private channel that only you and the staff can see.\n\n" +
            "**Use a ticket for:**\n" +
            "- Questions for the staff\n" +
            "- Problems with verification\n" +
            "- Reporting something\n\n" +
            "You can have 2 tickets open at the same time, please don't open one for no reason.",
        )
        .setFooter({ text: "When a ticket is closed a copy of the messages is saved for the staff, read more with /privacy policy" });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`${TICKET_BUTTON_ID}:create`)
            .setLabel("Create ticket")
            .setEmoji("🎫")
            .setStyle(ButtonStyle.Primary),
    );

    await channel.send({ embeds: [embed], components: [row] });

    // the staff get in with their role, without them only the admins can see the tickets
    const modRoleId = await GetServerConfig(interaction.guild.id, "modRoleId");
    const adminRoleId = await GetServerConfig(interaction.guild.id, "adminRoleId");
    const logChannelId = await GetServerConfig(interaction.guild.id, "logChannel");

    const warnings = [
        ...(!modRoleId && !adminRoleId ? ["No mod or admin role is set, so only people with the administrator permission can see tickets."] : []),
        ...(!logChannelId ? ["No log channel is set, so no copy of the messages is saved when a ticket is closed."] : []),
    ];

    if (warnings.length > 0) {
        await interaction.editReply(`The ticket button is posted.\n${warnings.join("\n")}`);
        return;
    }

    await interaction.deleteReply();
};