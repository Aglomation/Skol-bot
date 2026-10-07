import type { ChatInputCommandInteraction, Client, GuildMember, SlashCommandSubcommandBuilder } from "discord.js";
import { EmbedBuilder, MessageFlags, PermissionFlagsBits } from "discord.js";
import { GetFullServerConfig } from "../../../utils/configManager.js";
import { Mention, SETTINGS } from "./settings.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("view")
		.setDescription("Show all the current server settings");

export default async function command(
	interaction: ChatInputCommandInteraction,
	_client: Client,
) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const executor = interaction.member as GuildMember;
	if (!executor.permissions.has(PermissionFlagsBits.Administrator)) {
		await interaction.editReply("You don't have permission to use this.");
		return;
	}

	const config = await GetFullServerConfig(interaction.guild.id);

	const lines = SETTINGS.map((setting) => {
		const id = config?.[setting.key];
		return `**${setting.label}:** ${id ? Mention(setting, id) : "Not set"}`;
	});

	const embed = new EmbedBuilder()
		.setTitle("Server settings")
		.setDescription(lines.join("\n"))
		.setColor(0x5865F2);

	await interaction.editReply({ embeds: [embed] });
}
