import type { ChatInputCommandInteraction, GuildMember, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags } from "discord.js";
import { GetTicketForMember, GetTicketOwner } from "../../../utils/tickets.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("remove")
		.setDescription("Remove someone you added to this ticket.")
		.addUserOption((option) => option.setName("user").setDescription("The person to remove").setRequired(true));

export default async function command(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const ticket = await GetTicketForMember(interaction.guild, interaction.channelId, interaction.member as GuildMember);
	if (typeof ticket === "string") {
		await interaction.editReply(ticket);
		return;
	}

	const user = interaction.options.getUser("user", true);
	if (user.id === GetTicketOwner(ticket) || user.id === interaction.client.user?.id) {
		await interaction.editReply("You can't remove the owner of the ticket or me.");
		return;
	}
	
	const overwrite = ticket.permissionOverwrites.cache.get(user.id);
	if (!overwrite) {
		await interaction.editReply("They were not added to this ticket.");
		return;
	}

	try {
		await overwrite.delete();
	} catch (error) {
		console.error("Could not remove someone from a ticket:", error);
		await interaction.editReply("I couldn't remove them, check the console.");
		return;
	}

	await interaction.editReply(`<@${user.id}> has been removed from the ticket.`);
	await ticket.send({
		content: `<@${user.id}> was removed from the ticket by <@${interaction.user.id}>.`,
		allowedMentions: { parse: [] },
	}).catch(() => null);
}
