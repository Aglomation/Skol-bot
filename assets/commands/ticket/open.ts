import type { ChatInputCommandInteraction, GuildMember, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags } from "discord.js";
import { GetTicketForMember, OpenTicket } from "../../../features/tickets.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("open")
		.setDescription("Open this ticket again (staff only)");

export default async function command(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const ticket = await GetTicketForMember(interaction.guild, interaction.channelId, interaction.member as GuildMember, true, true);
	if (typeof ticket === "string") {
		await interaction.editReply(ticket);
		return;
	}

	const error = await OpenTicket(ticket, interaction.user);
	await interaction.editReply(error ?? "The ticket is opened.");
}
