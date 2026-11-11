import type { ChatInputCommandInteraction, GuildMember, SlashCommandSubcommandBuilder } from "discord.js";
import { EmbedBuilder, MessageFlags, OverwriteType } from "discord.js";
import { GetTicketClaimer, GetTicketForMember, GetTicketOwner, IsTicketClosed } from "../../../features/tickets.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("info")
		.setDescription("Show who owns this ticket, who is helping and who was added");

export default async function command(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const ticket = await GetTicketForMember(interaction.guild, interaction.channelId, interaction.member as GuildMember, false, true);
	if (typeof ticket === "string") {
		await interaction.editReply(ticket);
		return;
	}

	const ownerId = GetTicketOwner(ticket);
	const claimerId = GetTicketClaimer(ticket);

	// the people that were added with /ticket add, the staff get in through their roles
	const added = ticket.permissionOverwrites.cache
		.filter((overwrite) => overwrite.type === OverwriteType.Member && overwrite.id !== ownerId && overwrite.id !== interaction.client.user.id)
		.map((overwrite) => `<@${overwrite.id}>`);

	const embed = new EmbedBuilder()
		.setTitle(`Ticket ${ticket.name}`)
		.setColor(IsTicketClosed(ticket) ? 0xE74C3C : 0x2ECC71)
		.addFields(
			{ name: "Owner", value: ownerId ? `<@${ownerId}>` : "Unknown", inline: true },
			{ name: "Status", value: IsTicketClosed(ticket) ? "🔴 Closed" : "🟢 Open", inline: true },
			{ name: "Handled by", value: claimerId ? `<@${claimerId}>` : "Nobody yet", inline: true },
			{ name: "Created", value: `<t:${Math.floor(ticket.createdTimestamp / 1000)}:R>`, inline: true },
			{ name: "Added people", value: added.length > 0 ? added.join(", ").slice(0, 1024) : "Nobody" },
		);

	await interaction.editReply({ embeds: [embed] });
}
