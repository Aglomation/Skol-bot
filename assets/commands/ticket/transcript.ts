import type { ChatInputCommandInteraction, GuildMember, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags } from "discord.js";
import { BuildTranscriptFile, GetTicketForMember } from "../../../features/tickets.js";
import { ExplainError } from "../../../utils/errorText.js";

// reading a whole ticket takes up to 10 requests to discord, so a ticket can only be asked for once a minute
const COOLDOWN_MS = 60 * 1000;
const lastRequest = new Map<string, number>();

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("transcript")
		.setDescription("Get the messages of this ticket as a text file, only you can see it");

export default async function command(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const ticket = await GetTicketForMember(interaction.guild, interaction.channelId, interaction.member as GuildMember, false, true);
	if (typeof ticket === "string") {
		await interaction.editReply(ticket);
		return;
	}

	const wait = (lastRequest.get(ticket.id) ?? 0) + COOLDOWN_MS - Date.now();
	if (wait > 0) {
		await interaction.editReply(`Someone just asked for this, try again in ${Math.ceil(wait / 1000)} seconds.`);
		return;
	}
	lastRequest.set(ticket.id, Date.now());

	try {
		const file = await BuildTranscriptFile(ticket, interaction.user, "Requested by");
		await interaction.editReply({ content: "Here are the messages of this ticket:", files: [file] });
	} catch (error) {
		await interaction.editReply(`I couldn't make the transcript: ${ExplainError(error)}`);
	}
}
