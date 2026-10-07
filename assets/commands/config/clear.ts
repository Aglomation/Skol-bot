import type { ChatInputCommandInteraction, Client, GuildMember, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import type { ServerConfig } from "../../../utils/configManager.js";
import { GetFullServerConfig, UpdateServerConfig } from "../../../utils/configManager.js";
import { SETTINGS } from "./settings.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("clear")
		.setDescription("Remove a server setting")
		.addStringOption((option) =>
			option
				.setName("setting")
				.setDescription("The setting to remove")
				.setRequired(true)
				.addChoices(...SETTINGS.map((s) => ({ name: s.label, value: s.name }))),
		);

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

	const setting = SETTINGS.find((s) => s.name === interaction.options.getString("setting", true));
	if (!setting) {
		await interaction.editReply("Unknown setting.");
		return;
	}

	// no point making a config just to clear something
	const config = await GetFullServerConfig(interaction.guild.id);
	if (!config?.[setting.key]) {
		await interaction.editReply(`**${setting.label}** isn't set.`);
		return;
	}

	await UpdateServerConfig(interaction.guild.id, { [setting.key]: null } as Partial<ServerConfig>);

	const saved = await GetFullServerConfig(interaction.guild.id, true);
	if (saved?.[setting.key]) {
		await interaction.editReply(`Failed to clear **${setting.label}**.`);
		return;
	}

	await interaction.editReply(`**${setting.label}** has been cleared.`);
}
