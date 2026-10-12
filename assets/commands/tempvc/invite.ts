import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags } from "discord.js";
import { GetTempChannel, WithChannelOption } from "./shared.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	WithChannelOption(
		subcommand
			.setName("invite")
			.setDescription("Let someone see and join your temporary voice channel, also when the whitelist is on")
			.addUserOption((option) =>
				option
					.setName("user")
					.setDescription("The user to invite")
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
	if (user.bot) {
		await interaction.editReply({ content: "Invalid user. Please provide a valid user." });
		return;
	}

	try {
		await channel.permissionOverwrites.edit(user.id, {
			ViewChannel: true,
			Connect: true,
			Speak: true,
		});

		await interaction.editReply({ content: `<@${user.id}> has been invited to **<#${channel.id}>**.` });
	} catch (error) {
		console.error("Failed to invite user to temporary channel:", error);
		await interaction.editReply({ content: "An error occurred while trying to apply the setting." });
	}
}
