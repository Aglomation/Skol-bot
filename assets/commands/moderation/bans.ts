import type { ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder } from "discord.js";
import { EmbedBuilder, MessageFlags, PermissionFlagsBits } from "discord.js";
import { FlattenActions, GetActiveBan, GetModProfiles } from "../../../utils/moderationManager.js";
import { FormatAction, HasPermission, MakePages, SendPages } from "./shared.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("bans")
		.setDescription("See the latest softbans")
		.addBooleanOption((option) =>
			option
				.setName("active")
				.setDescription("Only show bans that are active right now")
				.setRequired(false),
		);

export default async function command(
	interaction: ChatInputCommandInteraction,
	_client: Client,
) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	if (!(await HasPermission(interaction, PermissionFlagsBits.MuteMembers))) return;

	const onlyActive = interaction.options.getBoolean("active") ?? false;

	const profiles = await GetModProfiles(interaction.guild.id, ["softban"]);

	// the case number of every ban that is active right now
	const activeBans = new Set<string>();
	for (const profile of profiles) {
		const ban = GetActiveBan({ moderation: profile.actions });
		if (ban) activeBans.add(`${profile.userId}:${ban.number}`);
	}

	const entries = FlattenActions(profiles)
		.filter((entry) => entry.action.type === "softban" && !entry.action.voided)
		.filter((entry) => !onlyActive || activeBans.has(`${entry.userId}:${entry.number}`))
		.slice(0, 100);

	if (entries.length === 0) {
		await interaction.editReply(onlyActive ? "Nobody is softbanned right now." : "No softbans found.");
		return;
	}

	const pages = MakePages(
		entries.map((entry) => `${activeBans.has(`${entry.userId}:${entry.number}`) ? "🔴" : "⚪"} ${FormatAction(entry, entry.userId)}`),
	);

	await SendPages(interaction, pages, (text, page, total) =>
		new EmbedBuilder()
			.setTitle(onlyActive ? "Active softbans" : "Latest softbans")
			.setDescription(`🔴 active • ⚪ ended\n\n${text}`)
			.setColor(0xE74C3C)
			.setFooter({ text: `Page ${page + 1}/${total} • ${entries.length} entries` }),
	);
}
