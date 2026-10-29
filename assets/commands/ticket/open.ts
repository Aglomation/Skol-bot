import type { ChatInputCommandInteraction, GuildMember, SlashCommandSubcommandBuilder, TextChannel } from "discord.js";
import { MessageFlags } from "discord.js";
import { GetTicketForMember, IsTicketClosed, OpenTicket } from "../../../utils/tickets.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("open")
		.setDescription("Open this ticket");

export default async function command(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const isClosed = IsTicketClosed(interaction.channel as TextChannel);
    if (!isClosed) {
        await interaction.editReply("This ticket is already open.");
        return;
    }
	const ticket = await GetTicketForMember(interaction.guild, interaction.channelId, interaction.member as GuildMember, true, true);
	if (typeof ticket === "string") {
		await interaction.editReply(ticket);
		return;
	}

	// the buttons are handled in assets/buttons/ticket.ts
	await interaction.editReply({
		content: "Opening the ticket...",
	});
    await OpenTicket(interaction.channel as TextChannel, interaction.user);
}
