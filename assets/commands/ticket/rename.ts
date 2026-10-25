import type { ChatInputCommandInteraction, GuildMember, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags } from "discord.js";
import { ExplainError } from "../../../utils/errorText.js";
import { GetTicketForMember, Slug } from "../../../utils/tickets.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("rename")
		.setDescription("Rename this ticket")
		.addStringOption((option) => option.setName("name").setDescription("The new name").setMinLength(1).setMaxLength(50).setRequired(true));

export default async function command(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const ticket = await GetTicketForMember(interaction.guild, interaction.channelId, interaction.member as GuildMember);
	if (typeof ticket === "string") {
		await interaction.editReply(ticket);
		return;
	}

	const name = `ticket-${Slug(interaction.options.getString("name", true))}`;
	if (ticket.name === name) {
		await interaction.editReply("It already has that name.");
		return;
	}

	try {
		await ticket.setName(name, `Renamed by ${interaction.user.username}`);
		await interaction.editReply(`Renamed to **${name}**.`);
	} catch (error) {
		await interaction.editReply(`I couldn't rename the ticket: ${ExplainError(error)}`);
	}
}
