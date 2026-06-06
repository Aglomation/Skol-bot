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
        .setTitle("Verify your email!")
        .setDescription("Click the button below to verify, by pressing the button you agree to follow the rules in <#1497140071176863759>\nMake sure to use your school email!")
        .setColor(0x87CFEB);

	const btn = new ButtonBuilder()
        .setCustomId(button.data.customId)
        .setLabel("Verify")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success);

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(btn);

	const channel = await client.channels.fetch(interaction.channel?.id || "") as TextChannel;
	if (!channel) return;

	await channel.send({ embeds: [embed], components: [row] });

	await interaction.deleteReply();
}