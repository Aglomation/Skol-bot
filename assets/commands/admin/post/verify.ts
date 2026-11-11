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
import { GetPostChannel } from "./shared.js";

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
		.setDescription("Klicka på den gröna knappen nedan för att verifiera dig.")
		.setColor(0x87CFEB)
		.setAuthor({
			name: "LBS Bot",
			iconURL: "https://cdn.discordapp.com/icons/1497140069746741338/28df0568dc08e6808436dcc53f3bc09b.webp",
		});

	const vbtn = new ButtonBuilder()
		.setCustomId(button.data.customId)
		.setLabel("Verifiera Här!")
		.setEmoji("✅")
		.setStyle(ButtonStyle.Success);
	const pbtn = new ButtonBuilder()
		.setCustomId("verify:privacy")
		.setLabel("Integritetspolicy")
		.setEmoji("📜")
		.setStyle(ButtonStyle.Secondary);
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(vbtn, pbtn);

	const channel = await GetPostChannel(interaction);
	if (!channel) return;

	await channel.send({ embeds: [embed], components: [row] });

	await interaction.deleteReply();
}
