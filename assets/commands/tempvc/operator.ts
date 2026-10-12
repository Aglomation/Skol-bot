import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { GetTempChannel, WithChannelOption } from "./shared.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	WithChannelOption(
		subcommand
			.setName("operator")
			.setDescription("Make someone an operator of your temporary voice channel, or remove them again")
			.addUserOption((option) =>
				option
					.setName("user")
					.setDescription("The user to add or remove as operator")
					.setRequired(true),
			),
	);

export default async function command(
	interaction: ChatInputCommandInteraction,
) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const channel = await GetTempChannel(interaction);
	if (!channel) return;

	const user = interaction.options.getUser("user", true);
	const member = await interaction.guild.members.fetch(user.id).catch(() => null);

	if (!member || user.bot || user.id === interaction.user.id) {
		await interaction.editReply({ content: "Invalid user. Please provide a valid user." });
		return;
	}
	if (member.permissions.has(PermissionFlagsBits.MoveMembers)) {
		await interaction.editReply({ content: "You cannot edit operator to a Moderator" });
		return;
	}

	try {
		// operator = can move members in the channel, using it again takes it away
		const isOperator = channel.permissionOverwrites.cache.get(user.id)?.allow.has(PermissionFlagsBits.MoveMembers);

		await channel.permissionOverwrites.edit(user.id, {
			Connect: true,
			Speak: true,
			MoveMembers: !isOperator,
		});

		await interaction.editReply({
			content: isOperator
				? `User <@${user.id}> has been removed as an operator for **<#${channel.id}>**.`
				: `User <@${user.id}> has been added as an operator for **<#${channel.id}>**.`,
		});
	} catch (error) {
		console.error("Failed to update temporary channel operator:", error);
		await interaction.editReply({ content: "An error occurred while trying to apply the setting." });
	}
}
