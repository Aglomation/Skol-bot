import type { ButtonInteraction, GuildMember } from "discord.js";
import { EmbedBuilder, MessageFlags } from "discord.js";
import { ExplainError } from "../../utils/errorText.js";
import { SendLog } from "../../utils/logChannel.js";
import {
	BuildTicketRows,
	CloseConfirmRow,
	CloseQuestion,
	CloseTicket,
	CreateTicket,
	GetTicketClaimer,
	GetTicketForMember,
	IsStaff,
	SetTicketClaimer,
	TICKET_BUTTON_ID,
} from "../../utils/tickets.js";

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
		const ticket = await GetTicketForMember(interaction.guild, interaction.channelId, member, action === "delete", action === "delete");

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
				const claimer = GetTicketClaimer(ticket);
				if (!(await IsStaff(member))) {
					await interaction.reply({ content: "Only the staff can do that.", flags: MessageFlags.Ephemeral });
					break;
				}
				if (claimer && claimer !== member.id) {
					await interaction.reply({ content: `<@${claimer}> is already handling this ticket.`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
					break;
				}

				const claiming = !claimer;
				await interaction.deferUpdate();

				try {
					await SetTicketClaimer(ticket, claiming ? member.id : null);
				} catch (error) {
					await interaction.followUp({ content: `I couldn't change that: ${ExplainError(error)}`, flags: MessageFlags.Ephemeral });
					break;
				}

				const embed = interaction.message.embeds[0];
				await interaction.editReply({
					embeds: embed ? [EmbedBuilder.from(embed).setFooter(claiming ? { text: `Claimed by ${member.displayName}` } : null)] : undefined,
					components: BuildTicketRows(claiming),
				});
				await ticket
					.send({
						content: claiming ? `✋ <@${member.id}> will help with this ticket.` : `<@${member.id}> is no longer handling this ticket.`,
						allowedMentions: { parse: [] },
					})
					.catch(() => null);
				break;
			}
			default:
				await interaction.reply({ content: "Unknown button.", flags: MessageFlags.Ephemeral });
		}
	},
};

export default button;
