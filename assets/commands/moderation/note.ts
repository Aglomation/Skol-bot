import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder, TextChannel } from "discord.js";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { AddModAction } from "../../../utils/moderationManager.js";
import { HasModPermission } from "./shared.js";
import { SendLog } from "../../../utils/logChannel.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("note")
		.setDescription("Add a staff-note (the user is not told)")
		.addUserOption((option) =>
			option.setName("user").setDescription("User to add the note to").setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("note")
				.setDescription("The note")
				.setMaxLength(500)
				.setRequired(true),
		);

export default async function command(
	interaction: ChatInputCommandInteraction
) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	if (!(await HasModPermission(interaction, PermissionFlagsBits.ModerateMembers))) return;

	const user = interaction.options.getUser("user", true);
	const note = interaction.options.getString("note", true);

	const caseNumber = await AddModAction(user.id, interaction.guild.id, {
		type: "note",
		by: interaction.user.id,
		reason: note,
	});

	if (!caseNumber) {
		await interaction.editReply("I couldn't save the note, check the console.");
		return;
	}

	await interaction.editReply(`Added a note to **${user.tag}**. (case #${caseNumber})`);

	await SendLog(interaction.client, interaction.guild.id, `${interaction.user.tag} added a note to <@${user.id}>: ${note} (case #${caseNumber})`);
}
