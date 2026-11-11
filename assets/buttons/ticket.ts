import type { ButtonInteraction, GuildMember, TextChannel } from "discord.js";
import { MessageFlags } from "discord.js";
import {
	ChangeClaim,
	CloseConfirmRow,
	CloseQuestion,
	CloseTicket,
	CreateTicket,
	GetTicketClaimer,
	GetTicketForMember,
	OpenTicket,
	TICKET_BUTTON_ID,
} from "../../features/tickets.js";
import { ExplainError } from "../../utils/errorText.js";
import { SendLog } from "../../utils/logChannel.js";

/** The close button: asks "are you sure" before anything happens */
async function AskToClose(interaction: ButtonInteraction, guildId: string) {
	await interaction.reply({
		content: await CloseQuestion(guildId),
		components: [CloseConfirmRow()],
		flags: MessageFlags.Ephemeral,
	});
}

async function ReopenTicket(interaction: ButtonInteraction, ticket: TextChannel) {
	await interaction.update({ content: "Opening the ticket...", components: [] });

	const error = await OpenTicket(ticket, interaction.user);
	await interaction.editReply({ content: error ?? "The ticket is opened." }).catch(() => null);
}

/** The "yes, close it" button of the question AskToClose asked */
async function CloseConfirmed(interaction: ButtonInteraction, ticket: TextChannel) {
	await interaction.update({ content: "Closing the ticket...", components: [] });

	const error = await CloseTicket(ticket, interaction.user);
	await interaction.editReply({ content: error ?? "The ticket is closed." }).catch(() => null);
}

async function DeleteTicket(interaction: ButtonInteraction, guildId: string, ticket: TextChannel) {
	await interaction.reply({ content: "Deleting the ticket...", flags: MessageFlags.Ephemeral });

	try {
		await ticket.delete(`Ticket deleted by ${interaction.user.username}`);
		await SendLog(interaction.client, guildId, `Ticket **${ticket.name}** was deleted by <@${interaction.user.id}>.`);
	} catch (error) {
		await interaction.editReply(`I couldn't delete it: ${ExplainError(error)}`);
	}
}

/** The claim button is a switch: it takes the ticket if nobody has it, and lets go of it if you have it */
async function ToggleClaim(interaction: ButtonInteraction, ticket: TextChannel, member: GuildMember) {
	await interaction.deferUpdate();

	const error = await ChangeClaim(ticket, member, !GetTicketClaimer(ticket), interaction.message);
	if (error) await interaction.followUp({ content: error, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
}

// the id of the buttons is "ticket:<action>"
const button: Button = {
	data: {
		customId: TICKET_BUTTON_ID,
	},
	async execute(interaction: ButtonInteraction) {
		if (!interaction.guild) {
			await interaction.reply({ content: "This button can only be used in a server.", flags: MessageFlags.Ephemeral });
			return;
		}

		const action = interaction.customId.split(":")[1];

		// the button in the panel, everything else is a button inside a ticket
		if (action === "create") {
			await CreateTicket(interaction);
			return;
		}

		// the owner and the staff can use them, but deleting and opening a closed ticket is only for the staff (and works on closed tickets)
		const member = interaction.member as GuildMember;
		const staffOnly = action === "delete" || action === "open";
		const ticket = await GetTicketForMember(interaction.guild, interaction.channelId, member, staffOnly, staffOnly);

		if (typeof ticket === "string") {
			if (action === "confirm" || action === "cancel") await interaction.update({ content: ticket, components: [] });
			else await interaction.reply({ content: ticket, flags: MessageFlags.Ephemeral });
			return;
		}

		switch (action) {
			case "close":
				return await AskToClose(interaction, interaction.guild.id);
			case "open":
				return await ReopenTicket(interaction, ticket);
			case "confirm":
				return await CloseConfirmed(interaction, ticket);
			case "delete":
				return await DeleteTicket(interaction, interaction.guild.id, ticket);
			case "cancel":
				await interaction.update({ content: "The ticket stays open.", components: [] });
				return;
			case "claim":
				return await ToggleClaim(interaction, ticket, member);
			default:
				await interaction.reply({ content: "Unknown button.", flags: MessageFlags.Ephemeral });
		}
	},
};

export default button;
