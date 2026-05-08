import type { GuildTextBasedChannel } from "discord.js";
import { SnowflakeUtil } from "discord.js";

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
		let oldestFetchedMessage = fetchedMessages.reduce(
			(oldest, message) =>
				message.createdTimestamp < oldest.createdTimestamp ? message : oldest,
			fetchedMessages.first(),
		);

		while (
			fetchedMessages.size > 0 &&
			oldestFetchedMessage?.createdTimestamp >= cutoffTimestamp
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
		if (messagesToDelete.size > 0) {
			await channel.bulkDelete(messagesToDelete, true);
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
