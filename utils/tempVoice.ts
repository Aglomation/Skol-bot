import type { Client, GuildBasedChannel, GuildMember, VoiceChannel } from "discord.js";
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

/**
 * When the owner leaves a channel that still has people in it, the next person gets it, an operator first
 * Their rights are taken from the one who left, and the name changes if it was the default one
 * @returns the new owner, or null if the leaver wasn't the owner or nobody is left
 */
export async function HandOverTempChannel(channel: VoiceChannel, leaver: GuildMember): Promise<GuildMember | null> {
	if (GetTempOwner(channel.id) !== leaver.id) return null;

	const people = channel.members.filter((member) => !member.user.bot && member.id !== leaver.id);
	const isOperator = (member: GuildMember) => channel.permissionOverwrites.cache.get(member.id)?.allow.has(PermissionFlagsBits.MoveMembers);
	const next = people.find(isOperator) ?? people.first();
	if (!next) return null;

	try {
		await channel.permissionOverwrites.edit(next.id, { ViewChannel: true, Connect: true, Speak: true, MoveMembers: true });
		await channel.permissionOverwrites.edit(leaver.id, { MoveMembers: null });
		SetTempOwner(channel.id, next.id);

		if (channel.name === `${leaver.displayName.slice(0, 90)}'s VC`) await channel.setName(`${next.displayName.slice(0, 90)}'s VC`);
		await channel.send({ content: `<@${next.id}> is now the owner of this channel.`, allowedMentions: { users: [next.id] } }).catch(() => null);
		return next;
	} catch (error) {
		console.error("Could not hand over a temporary channel:", error);
		return null;
	}
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
