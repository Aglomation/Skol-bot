import type { ButtonInteraction, GuildMember } from "discord.js";
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

		// the button in the panel
		if (action === "create") {
			await CreateTicket(interaction);
			return;
		}

		// the other buttons are in a ticket, the owner and the staff can use them
		const member = interaction.member as GuildMember;
		// deleting and opening a closed ticket is only for the staff, and works on closed tickets
		const staffOnly = action === "delete" || action === "open";
		const ticket = await GetTicketForMember(interaction.guild, interaction.channelId, member, staffOnly, staffOnly);

		if (typeof ticket === "string") {
			if (action === "confirm" || action === "cancel") await interaction.update({ content: ticket, components: [] });
			else await interaction.reply({ content: ticket, flags: MessageFlags.Ephemeral });
			return;
		}

		switch (action) {
			case "close":
				await interaction.reply({
					content: await CloseQuestion(interaction.guild.id),
					components: [CloseConfirmRow()],
					flags: MessageFlags.Ephemeral,
				});
				break;
			case "open": {
				await interaction.update({ content: "Opening the ticket...", components: [] });

				const error = await OpenTicket(ticket, interaction.user);
				await interaction.editReply({ content: error ?? "The ticket is opened." }).catch(() => null);
				break;
			}
			case "confirm": {
				await interaction.update({ content: "Closing the ticket...", components: [] });

				const error = await CloseTicket(ticket, interaction.user);
				await interaction.editReply({ content: error ?? "The ticket is closed." }).catch(() => null);
				break;
			}
			case "delete": {
				await interaction.reply({ content: "Deleting the ticket...", flags: MessageFlags.Ephemeral });

				try {
					await ticket.delete(`Ticket deleted by ${interaction.user.username}`);
					await SendLog(interaction.client, interaction.guild.id, `Ticket **${ticket.name}** was deleted by <@${interaction.user.id}>.`);
				} catch (error) {
					await interaction.editReply(`I couldn't delete it: ${ExplainError(error)}`);
				}
				break;
			}
			case "cancel":
				await interaction.update({ content: "The ticket stays open.", components: [] });
				break;
			case "claim": {
				await interaction.deferUpdate();

				// the button is a switch, it takes the ticket if nobody has it and lets go of it if you have it
				const error = await ChangeClaim(ticket, member, !GetTicketClaimer(ticket), interaction.message);
				if (error) await interaction.followUp({ content: error, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
				break;
			}
			default:
				await interaction.reply({ content: "Unknown button.", flags: MessageFlags.Ephemeral });
		}
	},
};

export default button;
