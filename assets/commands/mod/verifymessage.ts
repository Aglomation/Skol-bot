import type { ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder, TextChannel } from "discord.js";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	MessageFlags,
} from "discord.js";

import button from "../../buttons/verify.js";
export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
		.setName("verifymessage")
		.setDescription("Sends the message with button for verification");

export default async function command(
	interaction: ChatInputCommandInteraction,
	client: Client,
) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	if (
		interaction.user.id !== "754965470888722484" &&
		interaction.user.id !== "586643628990922752"
	) {
		await interaction.editReply({
			content: "You are not authorized to use this command.",
		});
		return;
	}
	const embed = new EmbedBuilder()
        .setTitle("Verifiera din LBS-mejl 🔒")
        .setDescription("Klicka på knappen nedan och godkänn reglerna i <#1497140071176863759> för att komma in på servern.")
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