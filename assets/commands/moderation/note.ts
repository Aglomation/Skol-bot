import type { ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder, TextChannel } from "discord.js";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { GetServerConfig } from "../../../utils/configManager.js";
import { AddModAction } from "../../../utils/moderationManager.js";
import { HasPermission } from "./shared.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("note")
		.setDescription("Add a note to a user, only staff can see it (the user is not told)")
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
	interaction: ChatInputCommandInteraction,
	client: Client,
) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	if (!(await HasPermission(interaction, PermissionFlagsBits.MuteMembers))) return;

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

	const logChannel = client.channels.cache.get(
		await GetServerConfig(interaction.guild.id, "logChannel") as string
	) as TextChannel | undefined;

	if (logChannel) {
		await logChannel.send(
			`${interaction.user.tag} added a note to <@${user.id}>: ${note} (case #${caseNumber})`,
		);
	}
}
