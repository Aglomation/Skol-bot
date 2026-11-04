import type { ChatInputCommandInteraction, GuildMember, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags } from "discord.js";
import { ChangeClaim, GetTicketForMember } from "../../../features/tickets.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("claim")
		.setDescription("Take this ticket, so the others know you are helping (staff only)");

export default async function command(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const member = interaction.member as GuildMember;
	const ticket = await GetTicketForMember(interaction.guild, interaction.channelId, member, true);
	if (typeof ticket === "string") {
		await interaction.editReply(ticket);
		return;
	}

	const error = await ChangeClaim(ticket, member, true);
	await interaction.editReply({ content: error ?? "You are handling this ticket now.", allowedMentions: { parse: [] } });
}
