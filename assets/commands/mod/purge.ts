import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { ExplainError } from "../../../utils/errorText.js";
import { SendLog } from "../../../utils/logChannel.js";
import { HasPermission } from "../../../utils/permissions.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("purge")
		.setDescription("Deletes the latest messages in this channel")
		.addIntegerOption((option) =>
			option.setName("count").setDescription("How many messages to delete (1-100)").setMinValue(1).setMaxValue(100).setRequired(true),
		)
		.addUserOption((option) => option.setName("user").setDescription("Only delete messages from this user"));

export default async function command(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	if (!(await HasPermission(interaction, PermissionFlagsBits.ManageMessages))) return;

	const channel = interaction.channel;
	const me = interaction.guild.members.me;
	if (!channel?.isTextBased() || channel.isDMBased() || !me || !channel.permissionsFor(me).has(PermissionFlagsBits.ManageMessages)) {
		await interaction.editReply("I can't delete messages in this channel, I need the Manage Messages permission here.");
		return;
	}

	const count = interaction.options.getInteger("count", true);
	const user = interaction.options.getUser("user");

	try {
		const fetched = channel.messages.cache;
		const ids = [...fetched.values()]
			.filter((message) => !message.pinned && (!user || message.author.id === user.id))
			.slice(0, count)
			.map((message) => message.id);

		if (ids.length === 0) {
			await interaction.editReply("There are no messages to delete.");
			return;
		}

		const deleted = await channel.bulkDelete(ids, true);
		const skipped = ids.length - deleted.size;

		await interaction.editReply(
			`Deleted ${deleted.size} message${deleted.size === 1 ? "" : "s"}${user ? ` from <@${user.id}>` : ""}.${skipped > 0 ? `\n${skipped} were older than 14 days, Discord doesn't allow deleting those in bulk.` : ""}\nPinned messages are never deleted.`,
		);
		await SendLog(interaction.client, interaction.guild.id, `<@${interaction.user.id}> deleted ${deleted.size} messages${user ? ` from <@${user.id}>` : ""} in <#${channel.id}>.`);
	} catch (error) {
		await interaction.editReply(`I couldn't delete the messages: ${ExplainError(error)}`);
	}
}
