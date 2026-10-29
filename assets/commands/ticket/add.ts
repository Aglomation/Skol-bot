import type { ChatInputCommandInteraction, GuildMember, SlashCommandSubcommandBuilder, TextChannel } from "discord.js";
import { MessageFlags } from "discord.js";
import { GetTicketForMember, IsTicketClosed } from "../../../utils/tickets.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("add")
		.setDescription("Add someone to this ticket")
		.addUserOption((option) => option.setName("user").setDescription("The person to add").setRequired(true));

export default async function command(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const ticket = await GetTicketForMember(interaction.guild, interaction.channelId, interaction.member as GuildMember, false, true);
	if (typeof ticket === "string") {
		await interaction.editReply(ticket);
		return;
	}
	const isClosed = IsTicketClosed(interaction.channel as TextChannel);
	const user = interaction.options.getUser("user", true);
	const target = await interaction.guild.members.fetch(user.id).catch(() => null);
	if (!target || target.user.bot) {
		await interaction.editReply("That has to be someone in this server, and not a bot.");
		return;
	}

	// only what is needed to read and write, mentioning someone in a ticket never adds them
	try {
		await ticket.permissionOverwrites.edit(target, {
			ViewChannel: true,
			SendMessages: !isClosed,
			ReadMessageHistory: true,
			AttachFiles: true,
			EmbedLinks: true,
		});
	} catch (error) {
		console.error("Could not add someone to a ticket:", error);
		await interaction.editReply("I couldn't add them, check the console.");
		return;
	}

	await interaction.editReply(`<@${target.id}> has been added to the ticket.`);
	await ticket.send({
		content: `<@${target.id}> was added to the ticket by <@${interaction.user.id}>.`,
		allowedMentions: { users: [target.id] },
	}).catch(() => null);
}
