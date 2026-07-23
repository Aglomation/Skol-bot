import type { ChatInputCommandInteraction, Client, GuildMember, SlashCommandSubcommandBuilder, TextChannel } from "discord.js";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	MessageFlags,
	PermissionsBitField,
} from "discord.js";

import button from "../../buttons/verify.js";
import { GetServerConfig } from "../../../utils/configManager.js";
export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
		.setName("verifymessage")
		.setDescription("Sends the message with button for verification");

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

	const embed = new EmbedBuilder()
        .setTitle("Verifiera din LBS-mejl 🔒")
        .setDescription("Klicka på knappen nedan och läs reglerna i <#1497140071176863759> för att komma in på servern.")
        .setColor(0x87CFEB);

	const btn = new ButtonBuilder()
        .setCustomId(button.data.customId)
        .setLabel("Verifiera Här!")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success);

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(btn);

	const channel = await client.channels.fetch(interaction.channel?.id || "") as TextChannel;
	if (!channel) return;

	await channel.send({ embeds: [embed], components: [row] });

	await interaction.deleteReply();
}