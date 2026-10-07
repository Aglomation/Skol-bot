import type { ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder } from "discord.js";
import { EmbedBuilder, MessageFlags, PermissionFlagsBits } from "discord.js";
import type { ModActionType } from "../../../utils/moderationManager.js";
import { FlattenActions, GetModProfiles } from "../../../utils/moderationManager.js";
import { FormatAction, HasPermission, MakePages, SendPages, TYPE_CHOICES } from "./shared.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("recent")
		.setDescription("See the latest moderation actions in the server")
		.addStringOption((option) =>
			option
				.setName("type")
				.setDescription("Only show one type")
				.setRequired(false)
				.addChoices(...TYPE_CHOICES),
		)
		.addUserOption((option) =>
			option
				.setName("moderator")
				.setDescription("Only show what this moderator did")
				.setRequired(false),
		)
		.addIntegerOption((option) =>
			option
				.setName("days")
				.setDescription("How many days back to look (default 30)")
				.setMinValue(1)
				.setMaxValue(3650)
				.setRequired(false),
		);

export default async function command(
	interaction: ChatInputCommandInteraction,
	_client: Client,
) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	if (!(await HasPermission(interaction, PermissionFlagsBits.MuteMembers))) return;

	const type = interaction.options.getString("type") as ModActionType | null;
	const moderator = interaction.options.getUser("moderator");
	const days = interaction.options.getInteger("days") ?? 30;
	const since = Date.now() - days * 24 * 60 * 60 * 1000;

	const profiles = await GetModProfiles(interaction.guild.id, type ? [type] : undefined);

	// newest first, only the latest 100 so it doesnt turn into a wall of pages
	const entries = FlattenActions(profiles)
		.filter((entry) => !entry.action.voided)
		.filter((entry) => entry.action.at >= since)
		.filter((entry) => !type || entry.action.type === type)
		.filter((entry) => !moderator || entry.action.by === moderator.id)
		.slice(0, 100);

	if (entries.length === 0) {
		await interaction.editReply(`No moderation actions in the last ${days} days with those filters.`);
		return;
	}

	const pages = MakePages(entries.map((entry) => FormatAction(entry, entry.userId)));

	await SendPages(interaction, pages, (text, page, total) =>
		new EmbedBuilder()
			.setTitle("Recent moderation actions")
			.setDescription(text)
			.setColor(0x5865F2)
			.setFooter({ text: `Page ${page + 1}/${total} • ${entries.length} entries • last ${days} days` }),
	);
}
