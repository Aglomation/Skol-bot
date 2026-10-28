import type { ChatInputCommandInteraction, GuildMember, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags } from "discord.js";
import { CloseConfirmRow, CloseQuestion, GetTicketForMember } from "../../../utils/tickets.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("close")
		.setDescription("Close this ticket");

export default async function command(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const ticket = await GetTicketForMember(interaction.guild, interaction.channelId, interaction.member as GuildMember);
	if (typeof ticket === "string") {
		await interaction.editReply(ticket);
		return;
	}

	// the buttons are handled in assets/buttons/ticket.ts
	await interaction.editReply({
		content: await CloseQuestion(interaction.guild.id),
		components: [CloseConfirmRow()],
	});
}
