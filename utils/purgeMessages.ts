import type { GuildTextBasedChannel } from "discord.js";
import { SnowflakeUtil } from "discord.js";

const MAX_PAGES = 50;

/**
 *
 * @param channel
 * @param targetUserId
 * @returns
 */
export async function purgeMessages(
	channel: GuildTextBasedChannel,
	targetUserId: string,
	deleteOlderThanMs = 60 * 60 * 1000, // Default to 1 hour
): Promise<number> {
	try {
		const cutoffTimestamp = Date.now() - deleteOlderThanMs;
		let fetchedMessages = await channel.messages.fetch({ limit: 100 });
		if (fetchedMessages.size === 0) return 0;
		let oldestFetchedMessage = fetchedMessages.reduce(
			(oldest, message) =>
				message.createdTimestamp < oldest.createdTimestamp ? message : oldest,
			fetchedMessages.first(),
		);

		let pages = 0;
		while (
			fetchedMessages.size > 0 &&
			oldestFetchedMessage?.createdTimestamp >= cutoffTimestamp &&
			pages++ < MAX_PAGES
		) {
			const olderMessages = await channel.messages.fetch({
				limit: 100,
				before: oldestFetchedMessage.id,
			});

			if (olderMessages.size === 0) {
				break;
			}

			fetchedMessages = fetchedMessages.concat(olderMessages);
			oldestFetchedMessage = olderMessages.reduce(
				(oldest, message) =>
					message.createdTimestamp < oldest.createdTimestamp ? message : oldest,
				olderMessages.first(),
			);
		}

		// Filter for the users messages from the past hour
		const messagesToDelete = fetchedMessages.filter(
			(msg) =>
				msg.author.id === targetUserId &&
				msg.createdTimestamp >= cutoffTimestamp,
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

export async function purgeChannels(
	channels: GuildTextBasedChannel[],
	targetUserId: string,
	deleteOlderThanMs = 60 * 60 * 1000, // Default to 1 hour
) {
	const purgePromises = channels.map(async (channel) => {
		const textChannel = channel as GuildTextBasedChannel;

		// Skip inactive channels
		if (textChannel.lastMessageId) {
			const lastMessageTime = SnowflakeUtil.timestampFrom(
				textChannel.lastMessageId,
			);
			if (lastMessageTime < Date.now() - deleteOlderThanMs) {
				return 0;
			}
		}

		return await purgeMessages(textChannel, targetUserId, deleteOlderThanMs);
	});

	// deletes in parrallel
	const results = await Promise.all(purgePromises);
	return results;
}
