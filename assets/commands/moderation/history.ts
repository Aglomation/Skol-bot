import type { ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder } from "discord.js";
import { EmbedBuilder, MessageFlags, PermissionFlagsBits } from "discord.js";
import type { ModActionType, NumberedAction } from "../../../utils/moderationManager.js";
import { GetActiveBan, GetActiveMute } from "../../../utils/moderationManager.js";
import { GetProfile } from "../../../utils/profileManager.js";
import { CountByType, FormatAction, HasPermission, MakePages, SendPages, Time, TYPE_CHOICES, TYPE_INFO } from "./shared.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("history")
		.setDescription("See everything the moderators have done to a user")
		.addUserOption((option) =>
			option.setName("user").setDescription("User to look up").setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("type")
				.setDescription("Only show one type")
				.setRequired(false)
				.addChoices(...TYPE_CHOICES),
		)
		.addBooleanOption((option) =>
			option
				.setName("voided")
				.setDescription("Also show voided cases")
				.setRequired(false),
		);

export default async function command(
	interaction: ChatInputCommandInteraction,
	_client: Client,
) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	if (!(await HasPermission(interaction, PermissionFlagsBits.MuteMembers))) return;

	const user = interaction.options.getUser("user", true);
	const type = interaction.options.getString("type") as ModActionType | null;
	const showVoided = interaction.options.getBoolean("voided") ?? false;

	const profile = await GetProfile(user.id, interaction.guild.id);
	const actions = profile?.moderation ?? [];

	if (actions.length === 0) {
		await interaction.editReply(`**${user.tag}** has no moderation history.`);
		return;
	}

	// the case number is the position in the full list, so number before filtering
	const entries: NumberedAction[] = actions
		.map((action, index) => ({ number: index + 1, action }))
		.filter((entry) => (showVoided || !entry.action.voided) && (!type || entry.action.type === type))
		.reverse();

	if (entries.length === 0) {
		await interaction.editReply(`Nothing to show for **${user.tag}** with those filters.`);
		return;
	}

	// short summary at the top
	const counts = CountByType(actions);
	const summary = (["warn", "mute", "softban", "note"] as const)
		.filter((t) => counts[t] > 0)
		.map((t) => `${TYPE_INFO[t].emoji} ${counts[t]} ${TYPE_INFO[t].label.toLowerCase()}${counts[t] === 1 ? "" : "s"}`)
		.join(" • ");

	const status: string[] = [];
	const mute = GetActiveMute(profile);
	const ban = GetActiveBan(profile);
	if (mute) status.push(`🔇 **Muted** ${mute.action.until ? `until ${Time(mute.action.until)}` : "forever"} (case #${mute.number})`);
	if (ban) status.push(`🔨 **Softbanned** ${ban.action.until ? `until ${Time(ban.action.until)}` : "forever"} (case #${ban.number})`);

	const header = [summary || "No actions", ...status].join("\n");
	const pages = MakePages(entries.map((entry) => FormatAction(entry)));

	await SendPages(interaction, pages, (text, page, total) =>
		new EmbedBuilder()
			.setAuthor({ name: `History for ${user.tag}`, iconURL: user.displayAvatarURL() })
			.setDescription(`${header}\n\n${text}`)
			.setColor(ban ? 0xE74C3C : mute ? 0xE67E22 : 0x5865F2)
			.setFooter({ text: `Page ${page + 1}/${total} • ${entries.length} entries • ${user.id}` }),
	);
}
