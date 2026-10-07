import type { ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder } from "discord.js";
import { EmbedBuilder, MessageFlags, PermissionFlagsBits } from "discord.js";
import type { ModActionType } from "../../../utils/moderationManager.js";
import { FlattenActions, GetActiveBan, GetActiveMute, GetModProfiles } from "../../../utils/moderationManager.js";
import { HasPermission, TYPE_INFO } from "./shared.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("stats")
		.setDescription("Numbers about the moderation in this server")
		.addIntegerOption((option) =>
			option
				.setName("days")
				.setDescription("How many days back to count (default 30)")
				.setMinValue(1)
				.setMaxValue(3650)
				.setRequired(false),
		);

function TopList(counts: Map<string, number>, max = 5): string {
	const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max);
	return top.length > 0 ? top.map(([id, count], i) => `${i + 1}. <@${id}> • ${count}`).join("\n") : "Nobody";
}

export default async function command(
	interaction: ChatInputCommandInteraction,
	_client: Client,
) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	if (!(await HasPermission(interaction, PermissionFlagsBits.MuteMembers))) return;

	const days = interaction.options.getInteger("days") ?? 30;
	const since = Date.now() - days * 24 * 60 * 60 * 1000;

	const profiles = await GetModProfiles(interaction.guild.id);
	const entries = FlattenActions(profiles).filter((entry) => !entry.action.voided);

	if (entries.length === 0) {
		await interaction.editReply("There is no moderation history yet.");
		return;
	}

	const types = Object.keys(TYPE_INFO) as ModActionType[];
	const total: Record<string, number> = {};
	const recent: Record<string, number> = {};
	const moderators = new Map<string, number>();
	const users = new Map<string, number>();

	for (const { userId, action } of entries) {
		total[action.type] = (total[action.type] ?? 0) + 1;
		if (action.at < since) continue;

		recent[action.type] = (recent[action.type] ?? 0) + 1;

		// notes and the unmutes/unbans dont say much about how much a mod or user is involved
		if (action.type === "warn" || action.type === "mute" || action.type === "softban") {
			users.set(userId, (users.get(userId) ?? 0) + 1);
			if (action.by) moderators.set(action.by, (moderators.get(action.by) ?? 0) + 1);
		}
	}

	let activeMutes = 0;
	let activeBans = 0;
	for (const profile of profiles) {
		const profileData = { moderation: profile.actions };
		if (GetActiveMute(profileData)) activeMutes++;
		if (GetActiveBan(profileData)) activeBans++;
	}

	const counts = types
		.map((type) => `${TYPE_INFO[type].emoji} ${TYPE_INFO[type].label}: **${recent[type] ?? 0}** (${total[type] ?? 0} total)`)
		.join("\n");

	const embed = new EmbedBuilder()
		.setTitle(`Moderation stats (last ${days} days)`)
		.addFields(
			{ name: "Actions", value: counts },
			{ name: "Active right now", value: `🔇 ${activeMutes} muted\n🔨 ${activeBans} softbanned`, inline: true },
			{ name: "Users with history", value: `${profiles.length}`, inline: true },
			{ name: "Most active moderators", value: TopList(moderators) },
			{ name: "Most actioned users", value: TopList(users) },
		)
		.setColor(0x5865F2)
		.setTimestamp();

	await interaction.editReply({ embeds: [embed] });
}
