import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags, OverwriteType, PermissionFlagsBits } from "discord.js";
import { GetServerConfig } from "../../../utils/configManager.js";
import { GetTempChannel, WithChannelOption } from "./shared.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	WithChannelOption(
		subcommand
			.setName("visibility")
			.setDescription("Choose who can see your temporary voice channel")
			.addStringOption((option) =>
				option
					.setName("who")
					.setDescription("Who can see the channel")
					.setRequired(true)
					.addChoices(
						{ name: "Everyone", value: "everyone" },
						{ name: "Join Only", value: "join-only" },
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

	const who = interaction.options.getString("who", true);

	try {
		// the verified members see the channel, or everyone if there is no verified role
		const verifiedRoleId = await GetServerConfig(interaction.guild.id, "verifiedRoleId");
		const viewers = verifiedRoleId || interaction.guild.roles.everyone;

		if (who === "everyone") {
			await channel.permissionOverwrites.edit(viewers, { ViewChannel: true });
			await interaction.editReply({ content: `Visibility for **<#${channel.id}>** has been set to **Everyone**.` });
			return;
		}

		// the people that can join (invited, operators) keep seeing it
		const allowedUsers = channel.permissionOverwrites.cache.filter(
			(overwrite) =>
				overwrite.type === OverwriteType.Member &&
				overwrite.allow.has(PermissionFlagsBits.Connect),
		);

		for (const overwrite of allowedUsers.values()) {
			await channel.permissionOverwrites.edit(overwrite.id, { ViewChannel: true });
		}

		await channel.permissionOverwrites.edit(viewers, { ViewChannel: false });

		await interaction.editReply({ content: `Visibility for **<#${channel.id}>** has been set to **Join Only**.` });
	} catch (error) {
		console.error("Failed to update temporary channel visibility:", error);
		await interaction.editReply({ content: "An error occurred while trying to apply the setting." });
	}
}
