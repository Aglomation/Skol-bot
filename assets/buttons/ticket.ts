import type { ButtonInteraction, GuildMember } from "discord.js";
import { MessageFlags } from "discord.js";
import {
	CloseConfirmRow,
	CloseQuestion,
	CloseTicket,
	CreateTicket,
	GetTicketForMember,
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
		const ticket = await GetTicketForMember(interaction.guild, interaction.channelId, member);

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
				// the message is gone with the channel when it worked
				if (error) await interaction.editReply({ content: error }).catch(() => null);
				break;
			}
			case "cancel":
				await interaction.update({ content: "The ticket stays open.", components: [] });
				break;
			default:
				await interaction.reply({ content: "Unknown button.", flags: MessageFlags.Ephemeral });
		}
	},
};

export default button;
