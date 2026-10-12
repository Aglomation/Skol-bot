import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import {
    MessageFlags,
    PermissionFlagsBits,
} from "discord.js";
import { HasPermission } from "../../../../utils/permissions.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
		.setName('ticket')
        .setDescription('Posts the server rules embed into the current channel.');

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

    await channel.send("**Channels mentioned in the rules:**\n§2.2: <#1497140071391039520>\n§3.4: <#1497140071864864769>\nFooter: <#1499885683995840683>");

    await interaction.deleteReply();
};