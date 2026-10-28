import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags } from "discord.js";
import { ExplainError } from "../../../utils/errorText.js";
import { GetTempOwner, SetTempOwner } from "../../../utils/tempVoice.js";
import { GetTempChannel, WithChannelOption } from "./shared.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	WithChannelOption(
		subcommand
			.setName("transfer")
			.setDescription("Give your temporary voice channel to someone who is in it")
			.addUserOption((option) => option.setName("user").setDescription("The new owner").setRequired(true)),
	);

export default async function command(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const channel = await GetTempChannel(interaction);
	if (!channel) return;

	const user = interaction.options.getUser("user", true);
	if (user.bot || user.id === interaction.user.id) {
		await interaction.editReply({ content: "Invalid user. Please provide a valid user." });
		return;
	}

	const owner = GetTempOwner(channel.id);
	if (owner && owner !== interaction.user.id) {
		await interaction.editReply({ content: "Only the owner can give the channel away." });
		return;
	}
	if (!channel.members.has(user.id)) {
		await interaction.editReply({ content: "They have to be in the channel." });
		return;
	}

	try {
		await channel.permissionOverwrites.edit(user.id, {
			ViewChannel: true,
			Connect: true,
			Speak: true,
			MoveMembers: true,
		});
		await channel.permissionOverwrites.edit(interaction.user.id, { MoveMembers: null });
		SetTempOwner(channel.id, user.id);

		await interaction.editReply({ content: `**<#${channel.id}>** now belongs to <@${user.id}>.` });
		await channel
			.send({ content: `<@${user.id}> is now the owner of this channel.`, allowedMentions: { users: [user.id] } })
			.catch(() => null);
	} catch (error) {
		await interaction.editReply({ content: `I couldn't transfer the channel: ${ExplainError(error)}` });
	}
}
