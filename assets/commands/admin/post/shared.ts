import type { ChatInputCommandInteraction, GuildTextBasedChannel } from "discord.js";
import { PermissionFlagsBits } from "discord.js";

/**
 * The channel the command was used in, if the bot is allowed to post there, replies with why not if it isn't
 * Needs a deferred reply
 */
export async function GetPostChannel(interaction: ChatInputCommandInteraction): Promise<GuildTextBasedChannel | null> {
	const channel = interaction.channel;
	if (!channel?.isTextBased() || channel.isDMBased()) {
		await interaction.editReply("This command must be run in a server text channel.");
		return null;
	}

	const botMember = interaction.guild?.members.me;
	if (!botMember || !channel.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages)) {
		await interaction.editReply("I don't have permission to send messages in this channel.");
		return null;
	}

	return channel;
}
