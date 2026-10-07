import type { ChatInputCommandInteraction, GuildMember } from "discord.js";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	EmbedBuilder,
} from "discord.js";
import type { ModAction, ModActionType, NumberedAction } from "../../../utils/moderationManager.js";

export const TYPE_INFO: Record<ModActionType, { emoji: string; label: string; color: number }> = {
	warn: { emoji: "⚠️", label: "Warn", color: 0xFFA500 },
	mute: { emoji: "🔇", label: "Mute", color: 0xE67E22 },
	unmute: { emoji: "🔊", label: "Unmute", color: 0x2ECC71 },
	softban: { emoji: "🔨", label: "Softban", color: 0xE74C3C },
	unban: { emoji: "🕊️", label: "Unban", color: 0x2ECC71 },
	note: { emoji: "📝", label: "Note", color: 0x95A5A6 },
};

// Used for the choices in the commands
export const TYPE_CHOICES = (Object.keys(TYPE_INFO) as ModActionType[]).map((type) => ({
	name: TYPE_INFO[type].label,
	value: type,
}));

/**
 * Checks if the mod is allowed to use the command, replies if they arent
 */
export async function HasPermission(
	interaction: ChatInputCommandInteraction,
	permission: bigint,
): Promise<boolean> {
	const executor = interaction.member as GuildMember;
	if (executor.permissions.has(permission)) return true;

	await interaction.editReply("You don't have permission to use this.");
	return false;
}

/**
 * Discord timestamp, shows in everyones own timezone
 */
export function Time(ms: number, style: "f" | "R" | "d" = "f"): string {
	return `<t:${Math.floor(ms / 1000)}:${style}>`;
}

function Shorten(text: string, max: number): string {
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Makes one history entry into text
 * @param userId Pass this to show who it was done to (for lists with many users)
 */
export function FormatAction(entry: NumberedAction, userId?: string): string {
	const { number, action } = entry;
	const info = TYPE_INFO[action.type];

	let text = `**#${number}** ${info.emoji} **${info.label}**`;
	if (userId) text += ` • <@${userId}>`;
	text += ` • ${Time(action.at, "R")} • ${action.by ? `<@${action.by}>` : "unknown"}\n`;
	text += `> ${Shorten(action.reason || "No reason", 250)}\n`;

	const extra: string[] = [];
	if (action.until !== undefined) {
		if (action.until === null) extra.push("never ends");
		else extra.push(`${action.until > Date.now() ? "ends" : "ended"} ${Time(action.until)}`);
	}
	if (action.dm === false) extra.push("dm failed");
	if (extra.length > 0) text += `-# ${extra.join(" • ")}\n`;

	if (action.voided) {
		text += `-# 🚫 voided by <@${action.voided.by}> ${Time(action.voided.at, "R")}: ${Shorten(action.voided.reason, 100)}\n`;
		// strike through the main line so voided cases are easy to see
		text = text.replace(/^(.*)\n/, "~~$1~~\n");
	}

	return text;
}

/**
 * Counts the actions that arent voided
 */
export function CountByType(actions: ModAction[]): Record<ModActionType, number> {
	const counts: Record<ModActionType, number> = { warn: 0, mute: 0, unmute: 0, softban: 0, unban: 0, note: 0 };
	for (const action of actions) {
		if (!action.voided) counts[action.type]++;
	}
	return counts;
}

/**
 * Splits lines into pages that fit in an embed
 */
export function MakePages(lines: string[], maxChars = 3000, maxLines = 6): string[] {
	const pages: string[] = [];
	let current: string[] = [];
	let length = 0;

	for (const line of lines) {
		if (current.length > 0 && (length + line.length > maxChars || current.length >= maxLines)) {
			pages.push(current.join("\n"));
			current = [];
			length = 0;
		}
		current.push(line);
		length += line.length + 1;
	}
	if (current.length > 0) pages.push(current.join("\n"));

	return pages;
}

/**
 * Sends the pages with previous/next buttons, they stop working after 2 minutes
 */
export async function SendPages(
	interaction: ChatInputCommandInteraction,
	pages: string[],
	makeEmbed: (text: string, page: number, total: number) => EmbedBuilder,
): Promise<void> {
	let page = 0;

	const buttons = (disabled = false) =>
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(`modprev:${interaction.id}`)
				.setEmoji("⬅️")
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(disabled || page === 0),
			new ButtonBuilder()
				.setCustomId(`modnext:${interaction.id}`)
				.setEmoji("➡️")
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(disabled || page === pages.length - 1),
		);

	const message = await interaction.editReply({
		embeds: [makeEmbed(pages[0], 0, pages.length)],
		components: pages.length > 1 ? [buttons()] : [],
	});
	if (pages.length <= 1) return;

	const collector = message.createMessageComponentCollector({
		componentType: ComponentType.Button,
		time: 2 * 60 * 1000,
		filter: (i) => i.user.id === interaction.user.id && i.customId.endsWith(interaction.id),
	});

	collector.on("collect", async (i) => {
		page += i.customId.startsWith("modprev") ? -1 : 1;
		await i.update({
			embeds: [makeEmbed(pages[page], page, pages.length)],
			components: [buttons()],
		});
	});

	collector.on("end", async () => {
		await interaction.editReply({ components: [buttons(true)] }).catch(() => null);
	});
}
