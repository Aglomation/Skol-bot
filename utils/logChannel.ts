import type { Client, TextChannel } from "discord.js";
import { GetServerConfig } from "./configManager.js";

/**
 * Sends a message in the log channel of the server, does nothing if there isnt one
 * Mentions are turned off so a reason with @everyone or a role cant ping anyone, <@id> still shows the name
 */
export async function SendLog(client: Client, guildId: string, content: string): Promise<void> {
	const channelId = await GetServerConfig(guildId, "logChannel");
	if (!channelId) return;

	const channel = client.channels.cache.get(channelId) as TextChannel | undefined;
	if (!channel?.isTextBased()) return;

	await channel
		.send({ content, allowedMentions: { parse: [] } })
		.catch((error) => console.error("Could not send to the log channel:", error));
}
