import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { EmbedBuilder, MessageFlags } from "discord.js";
import { GetUpcoming } from "../../../utils/lfg.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand.setName("list").setDescription("Shows the list of sessions");

export default async function command(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) return;

	const sessions = (await GetUpcoming(interaction.guild.id)).slice(0, 15);
	if (sessions.length === 0) {
		await interaction.reply({ content: "There are no sessions right now, start one with `/lfg create`.", flags: MessageFlags.Ephemeral });
		return;
	}

	const lines = sessions.map((session) => {
		const url = `https://discord.com/channels/${session.guildId}/${session.channelId}/${session.id}`;
		const slots = session.maxPlayers === null ? `${session.going.length}` : `${session.going.length}/${session.maxPlayers}`;
		return `<t:${Math.floor(session.startsAt / 1000)}:R> **[${session.game}](${url})** · <@${session.hostId}> · ${slots} going`;
	});

	const embed = new EmbedBuilder().setTitle("Sessions").setColor(0x2ecc71).setDescription(lines.join("\n"));
	await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
}
