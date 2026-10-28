import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { ExplainError } from "../../../utils/errorText.js";
import { GetTempOwner } from "../../../utils/tempVoice.js";
import { GetTempChannel, WithChannelOption } from "./shared.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	WithChannelOption(
		subcommand
			.setName("kick")
			.setDescription("Remove someone from your temporary voice channel")
			.addUserOption((option) => option.setName("user").setDescription("The user to remove").setRequired(true))
			.addBooleanOption((option) =>
				option.setName("block").setDescription("Also stop them from joining again, /tempvc invite undoes it"),
			),
	);

export default async function command(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const channel = await GetTempChannel(interaction);
	if (!channel) return;

	const user = interaction.options.getUser("user", true);
	const block = interaction.options.getBoolean("block") ?? false;
	const member = await interaction.guild.members.fetch(user.id).catch(() => null);

	if (!member || user.bot || user.id === interaction.user.id) {
		await interaction.editReply({ content: "Invalid user. Please provide a valid user." });
		return;
	}

	const owner = GetTempOwner(channel.id);
	const isOperator = channel.permissionOverwrites.cache.get(user.id)?.allow.has(PermissionFlagsBits.MoveMembers);

	if (user.id === owner) {
		await interaction.editReply({ content: "You cannot remove the owner of the channel." });
		return;
	}
	if (member.permissions.has(PermissionFlagsBits.MoveMembers)) {
		await interaction.editReply({ content: "You cannot remove a Moderator." });
		return;
	}
	if (isOperator && owner && owner !== interaction.user.id) {
		await interaction.editReply({ content: "Only the owner can remove an operator." });
		return;
	}

	const inChannel = channel.members.has(user.id);
	if (!inChannel && !block) {
		await interaction.editReply({ content: "That user isn't in the channel." });
		return;
	}

	try {
		if (inChannel) await member.voice.disconnect(`Removed from the temporary channel by ${interaction.user.username}`);
		if (block) await channel.permissionOverwrites.edit(user.id, { Connect: false });

		await interaction.editReply({
			content: `<@${user.id}> was removed from **<#${channel.id}>**${block ? " and can't join again until you invite them" : ""}.`,
		});
	} catch (error) {
		await interaction.editReply({ content: `I couldn't remove them: ${ExplainError(error)}` });
	}
}
