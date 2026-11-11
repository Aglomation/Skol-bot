import type { GuildTextBasedChannel } from "discord.js";
import { SnowflakeUtil } from "discord.js";

/**
 * Deletes the messages of a user that are still in the cache of the channel and not older than the time
 * @returns How many messages were deleted
 */
async function PurgeMessages(
	channel: GuildTextBasedChannel,
	targetUserId: string,
	deleteOlderThanMs = 60 * 60 * 1000, // Default to 1 hour
): Promise<number> {
	try {
		const cutoffTimestamp = Date.now() - deleteOlderThanMs;

		const messagesToDelete = channel.messages.cache.filter(
			(msg) =>
				msg.author.id === targetUserId &&
				msg.createdTimestamp >= cutoffTimestamp
		);

		// Delete messages if found
		// bulkDelete takes 100 messages at most, sending more fails and deletes nothing
		const ids = [...messagesToDelete.keys()];
		for (let i = 0; i < ids.length; i += 100) {
			await channel.bulkDelete(ids.slice(i, i + 100), true);
		}

		return messagesToDelete.size;
	} catch (error) {
		console.error(`Failed to purge messages in channel ${channel.id}:`, error);
		return 0;
	}
}

export async function PurgeChannels(
	channels: GuildTextBasedChannel[],
	targetUserId: string,
	deleteOlderThanMs = 60 * 60 * 1000, // Default to 1 hour
) {
	const purgePromises = channels.map(async (channel) => {
		// Skip inactive channels
		if (channel.lastMessageId) {
			const lastMessageTime = SnowflakeUtil.timestampFrom(
				channel.lastMessageId,
			);
			if (lastMessageTime < Date.now() - deleteOlderThanMs) {
				return 0;
			}
		}

		return await PurgeMessages(channel, targetUserId, deleteOlderThanMs);
	});

	// deletes in parallel
	const results = await Promise.all(purgePromises);
	return results;
}
