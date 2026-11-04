import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";

export const SERVER_INVITE = "https://discord.gg/dUYHv8Dv94";

export const INVALID_DURATION = "Invalid duration format. Make sure to follow the format!\nExample: `1h` for 1 hour, `30m` for 30 minutes, `inf` for indefinite.";

// The choices of the deletemessages option in /mod ban and /mod mute, the values are read by ParseDuration
export const DELETE_MESSAGES_CHOICES = [
	{ name: "None", value: "0" },
	{ name: "1 Hour", value: "1h" },
	{ name: "3 Hours", value: "3h" },
	{ name: "6 Hours", value: "6h" },
	{ name: "12 Hours", value: "12h" },
	{ name: "1 Day", value: "24h" },
	{ name: "2 Days", value: "48h" },
];

/**
 * Defers the reply, public if the announce option is on and only for the moderator if not
 */
export async function DeferReply(interaction: ChatInputCommandInteraction): Promise<void> {
	await interaction.deferReply(interaction.options.getBoolean("announce") ? {} : { flags: MessageFlags.Ephemeral });
}
