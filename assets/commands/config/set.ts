import type { ChatInputCommandInteraction, Client, GuildMember, SlashCommandSubcommandBuilder } from "discord.js";
import { EmbedBuilder, MessageFlags, PermissionFlagsBits } from "discord.js";
import type { ServerConfig } from "../../../utils/configManager.js";
import { GetFullServerConfig, UpdateServerConfig } from "../../../utils/configManager.js";
import type { SettingKey } from "./settings.js";
import { Mention, SETTINGS, TEXT_CHANNELS } from "./settings.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) => {
	subcommand
		.setName("set")
		.setDescription("Change one or more server settings at once");

	for (const setting of SETTINGS) {
		if (setting.type === "role") {
			subcommand.addRoleOption((option) =>
				option.setName(setting.name).setDescription(setting.description),
			);
			continue;
		}

		subcommand.addChannelOption((option) =>
			option
				.setName(setting.name)
				.setDescription(setting.description)
				.addChannelTypes(...(setting.channelTypes ?? TEXT_CHANNELS)),
		);
	}

	return subcommand;
};

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

	// only the options that were filled in get changed
	const changes: Partial<Record<SettingKey, string>> = {};
	for (const setting of SETTINGS) {
		const value = setting.type === "role"
			? interaction.options.getRole(setting.name)
			: interaction.options.getChannel(setting.name);
		if (value) changes[setting.key] = value.id;
	}

	if (Object.keys(changes).length === 0) {
		await interaction.editReply("You didn't pick anything to change, fill in at least one option.");
		return;
	}

	await UpdateServerConfig(interaction.guild.id, changes as Partial<ServerConfig>);

	// get it again from the database so we only say saved if it actually saved
	const saved = await GetFullServerConfig(interaction.guild.id, true);

	const lines: string[] = [];
	let failed = false;
	for (const setting of SETTINGS) {
		const id = changes[setting.key];
		if (!id) continue;

		if (saved?.[setting.key] === id) {
			lines.push(`**${setting.label}:** ${Mention(setting, id)}`);
		} else {
			failed = true;
			lines.push(`**${setting.label}:** failed to save`);
		}
	}

	const embed = new EmbedBuilder()
		.setTitle(failed ? "⚠️ Some settings didn't save" : "✅ Settings updated")
		.setDescription(lines.join("\n"))
		.setColor(failed ? 0xFFA500 : 0x00FF00);

	await interaction.editReply({ embeds: [embed] });
}
