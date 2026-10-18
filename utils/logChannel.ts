import type { AttachmentBuilder, Client } from "discord.js";
import { GetServerConfig } from "./configManager.js";

// discord doesn't take messages over 2000 characters
const MAX_LENGTH = 2000;

/**
 * Sends a message in a channel, mentions are turned off so a reason with @everyone or a role cant ping anyone, <@id> still shows the name
 * A message that is too long is cut, it would not be sent at all otherwise
 * @returns true if it was sent
 */
export async function SendToChannel(client: Client, channelId: string, content: string, files: AttachmentBuilder[] = []): Promise<boolean> {
	const channel = client.channels.cache.get(channelId);
	if (!channel?.isTextBased() || !("send" in channel)) return false;

	const text = content.length > MAX_LENGTH ? `${content.slice(0, MAX_LENGTH - 1)}…` : content;

	try {
		await channel.send({ content: text, files, allowedMentions: { parse: [] } });
		return true;
	} catch (error) {
		console.error("Could not send to the channel:", error);
		return false;
	}
}

/**
 * Sends a message in the log channel of the server, does nothing if there isnt one
 * @returns true if it was sent
 */
export async function SendLog(client: Client, guildId: string, content: string): Promise<boolean> {
	const channelId = await GetServerConfig(guildId, "logChannel");
	if (!channelId) return false;

	return SendToChannel(client, channelId, content);
}
