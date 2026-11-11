import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { EmbedBuilder, MessageFlags } from "discord.js";
import { GetGiveaways, GiveawayLink, IsActive } from "../../../features/giveaway.js";

const MAX_LISTED = 15;

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand.setName("list").setDescription("See the giveaways that are running");

export default async function command(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const running = (await GetGiveaways(interaction.guild.id)).filter(IsActive).sort((a, b) => a.endsAt - b.endsAt);
	if (running.length === 0) {
		await interaction.editReply("No giveaways are running. Start one with `/giveaway start`.");
		return;
	}

	const lines = running.slice(0, MAX_LISTED).map((giveaway) => {
		const ends = Math.floor(giveaway.endsAt / 1000);
		return `**${giveaway.prize.slice(0, 80)}** • ends <t:${ends}:R> • ${giveaway.winnerCount} winner${giveaway.winnerCount === 1 ? "" : "s"}• ${giveaway.entrants.length} entered • [jump](${GiveawayLink(giveaway)})`;
	});
	if (running.length > MAX_LISTED) lines.push(`...and ${running.length - MAX_LISTED} more`);

	await interaction.editReply({
		embeds: [new EmbedBuilder().setTitle(`Running giveaways (${running.length})`).setDescription(lines.join("\n")).setColor(0xf1c40f)],
	});
}
