import type { ChatInputCommandInteraction, Client } from "discord.js";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from "discord.js";

import button from "../buttons/verify.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("verifymessage")
		.setDescription("Sends the message with button for verification")
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

	async execute(interaction: ChatInputCommandInteraction, _client: Client) {
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

		const btn = new ButtonBuilder()
			.setCustomId(button.data.customId)
			.setLabel("Verify")
			.setStyle(ButtonStyle.Success);

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(btn);

		await interaction.editReply({
			content: "Click the button below to verify yourself!",
			components: [row],
		});
	},
};

export default command;
