import { ChannelType } from "discord.js";
import type { ServerConfigKey } from "../../../utils/configManager.js";

// isDevServer is left out on purpose, it skips permission checks so it should only be changed in the database
export type SettingKey = Exclude<ServerConfigKey, "id" | "isDevServer">;

type SettingChannelType =
	| ChannelType.GuildText
	| ChannelType.GuildAnnouncement
	| ChannelType.GuildVoice
	| ChannelType.GuildCategory;

export type Setting = {
	name: string; // the name of the option in the command
	key: SettingKey; // the column in server_config
	label: string;
	description: string;
	type: "channel" | "role";
	channelTypes?: SettingChannelType[];
};

export const TEXT_CHANNELS: SettingChannelType[] = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

// Add a new setting here and it shows up in set, clear and view
export const SETTINGS: Setting[] = [
	{ name: "honeypot", key: "honeypotChannel", label: "Honeypot channel", description: "Anyone who writes here gets timed out and their messages wiped", type: "channel" },
	{ name: "log", key: "logChannel", label: "Log channel", description: "Where moderation logs are sent", type: "channel" },
	{ name: "welcome", key: "welcomeChannel", label: "Welcome channel", description: "Where new members get welcomed", type: "channel" },
	{ name: "birthday", key: "birthdayChannel", label: "Birthday channel", description: "Where birthday messages are sent", type: "channel" },
	{ name: "police", key: "policeChannel", label: "Police channel", description: "Where the police events are posted", type: "channel" },
	{ name: "support", key: "supportChannel", label: "Support channel", description: "The channel tickets are made in", type: "channel" },
	{ name: "verification", key: "verificationChannelId", label: "Verification channel", description: "The channel with the verify message", type: "channel" },
	{ name: "tempvc_channel", key: "tempVcMainChannel", label: "Temp VC channel", description: "Joining this voice channel creates a temporary one", type: "channel", channelTypes: [ChannelType.GuildVoice] },
	{ name: "tempvc_category", key: "tempvcCategory", label: "Temp VC category", description: "The category temporary voice channels are made in", type: "channel", channelTypes: [ChannelType.GuildCategory] },
	{ name: "verified_role", key: "verifiedRoleId", label: "Verified role", description: "Given to members when they verify", type: "role" },
	{ name: "teacher_role", key: "teacherRoleId", label: "Teacher role", description: "Given to verified teachers", type: "role" },
	{ name: "mod_role", key: "modRoleId", label: "Mod role", description: "The moderator role", type: "role" },
	{ name: "admin_role", key: "adminRoleId", label: "Admin role", description: "The admin role", type: "role" },
];

/**
 * Turns a saved id into a mention
 */
export function Mention(setting: Setting, id: string): string {
	return setting.type === "role" ? `<@&${id}>` : `<#${id}>`;
}
