import type { Client, GuildBasedChannel, VoiceChannel } from "discord.js";
import { ChannelType, OverwriteType, PermissionFlagsBits } from "discord.js";
import { GetServerConfig } from "./configManager.js";

// Who made which temporary channel, so an operator can't take it from them
// This is only in memory, after a restart the owner of the older channels isn't known and that check is skipped
const owners = new Map<string, string>();

export function SetTempOwner(channelId: string, userId: string): void {
	owners.set(channelId, userId);
}

export function GetTempOwner(channelId: string): string | null {
	return owners.get(channelId) ?? null;
}

export function ForgetTempChannel(channelId: string): void {
	owners.delete(channelId);
}

/**
 * A temporary channel is a voice channel in the temp category that has a member with the move members permission, that is the owner or an operator
 * Channels an admin put in the category by hand don't have one, so they are never deleted
 */
export function IsTempChannel(channel: GuildBasedChannel, mainChannelId: string, categoryId: string): channel is VoiceChannel {
	return (
		channel.type === ChannelType.GuildVoice &&
		channel.id !== mainChannelId &&
		channel.parentId === categoryId &&
		channel.permissionOverwrites.cache.some(
			(overwrite) => overwrite.type === OverwriteType.Member && overwrite.allow.has(PermissionFlagsBits.MoveMembers),
		)
	);
}

// Joining the main channel over and over would make a pile of channels
const CREATE_COOLDOWN_MS = 5 * 1000;
const lastCreated = new Map<string, number>();

/**
 * @returns true if this user can get a new temporary channel now, and notes that they got one
 */
export function CanCreateTempChannel(userId: string): boolean {
	const now = Date.now();

	if (lastCreated.size > 500) {
		for (const [id, time] of lastCreated) {
			if (now - time >= CREATE_COOLDOWN_MS) lastCreated.delete(id);
		}
	}

	if (now - (lastCreated.get(userId) ?? 0) < CREATE_COOLDOWN_MS) return false;
	lastCreated.set(userId, now);
	return true;
}

/**
 * Deletes the empty temporary channels, for the ones that were left behind when the bot was off
 */
export async function SweepTempChannels(client: Client): Promise<void> {
	for (const guild of client.guilds.cache.values()) {
		const mainChannelId = await GetServerConfig(guild.id, "tempVcMainChannel");
		const categoryId = await GetServerConfig(guild.id, "tempvcCategory");
		if (!mainChannelId || !categoryId) continue;

		for (const channel of guild.channels.cache.values()) {
			if (!IsTempChannel(channel, mainChannelId, categoryId) || channel.members.size > 0) continue;

			ForgetTempChannel(channel.id);
			await channel.delete("Empty temporary channel that was left behind").catch(() => null);
		}
	}
}
