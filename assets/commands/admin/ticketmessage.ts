import type { ChatInputCommandInteraction, Client, GuildMember, SlashCommandSubcommandBuilder, TextChannel } from "discord.js";
import {
    Colors,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    PermissionsBitField,
} from "discord.js";
import { GetServerConfig } from "../../../utils/configManager.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
		.setName('rulesmessage')
        .setDescription('Posts the server rules embed into the current channel.');

export default async function command(
	interaction: ChatInputCommandInteraction,
	client: Client,
) {
    if (!interaction.guild) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    // Check if the user has the "Ban Members" permission, which assumes you're a moderator or admin
    const executor = interaction.member as GuildMember;

    if (!executor.permissions.has(PermissionsBitField.Flags.BanMembers) && await GetServerConfig(interaction.guild.id, "isDevServer") === false) {
        await interaction.editReply("You don't have permission to use this.");
        return;
    }

        

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