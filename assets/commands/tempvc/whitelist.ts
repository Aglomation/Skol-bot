import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { GetTempChannel, WithChannelOption } from "./shared.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	WithChannelOption(
		subcommand
			.setName("whitelist")
			.setDescription("Only let invited users join your temporary voice channel")
			.addStringOption((option) =>
				option
					.setName("state")
					.setDescription("Turn the whitelist on or off")
					.setRequired(true)
					.addChoices(
						{ name: "Enable", value: "enable" },
						{ name: "Disable", value: "disable" },
						{ name: "Current State", value: "state" },
					),
			),
	);

export default async function command(
	interaction: ChatInputCommandInteraction,
) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const channel = await GetTempChannel(interaction);
	if (!channel) return;

	const state = interaction.options.getString("state", true);

	try {
		if (state === "state") {
			const enabled = channel.permissionOverwrites.cache.get(interaction.guild.roles.everyone.id)?.deny.has(PermissionFlagsBits.Connect);
			await interaction.editReply({ content: `Current whitelist is set to ${enabled ? "enabled" : "disabled"}` });
			return;
		}

		const enabled = state === "enable";
		await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
			Connect: !enabled,
		});

		await interaction.editReply({ content: `Whitelist for **<#${channel.id}>** has been **${enabled ? "enabled" : "disabled"}**.` });
	} catch (error) {
		console.error("Failed to update temporary channel whitelist:", error);
		await interaction.editReply({ content: "An error occurred while trying to apply the setting." });
	}
}
