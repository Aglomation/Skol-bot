import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	MessageFlags,
	PermissionFlagsBits,
} from "discord.js";
import { HasPermission } from "../../../../utils/permissions.js";
import button from "../../../buttons/verify.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
		.setName("verify")
		.setDescription("Sends the message with button for verification");

export default async function command(
	interaction: ChatInputCommandInteraction,
) {
	if (!interaction.guild) return;

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	// Ban Members assumes you're a moderator or admin
	if (!(await HasPermission(interaction, PermissionFlagsBits.BanMembers))) return;

	const embed = new EmbedBuilder()
        .setTitle("Verifiera din LBS-mejl 🔒")
		.setDescription("Klicka på knappen nedan och läs reglerna i <#1497140071176863759> för att komma in på servern")
		.setFooter({ text: "Använd /privacy policy för att läsa vår integritetspolicy. :3" })
        .setColor(0x87CFEB);

	const btn = new ButtonBuilder()
        .setCustomId(button.data.customId)
        .setLabel("Verifiera Här!")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success);

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(btn);

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

	await channel.send({ embeds: [embed], components: [row] });

	await interaction.deleteReply();
}
