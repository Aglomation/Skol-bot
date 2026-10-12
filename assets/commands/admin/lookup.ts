import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import {
	EmbedBuilder,
	MessageFlags,
	PermissionFlagsBits,
} from "discord.js";

import { getDisplayName } from "../../../utils/memberUtils.js";
import { HasPermission } from "../../../utils/permissions.js";
import type { UserProfileKey } from "../../../utils/profileManager.js";
import { FindByValue } from "../../../utils/profileManager.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
		.setName("lookup")
		.setDescription("String lookup for user profiles (for support only)")
		.addStringOption((option) => {
			const userProfileKeys = [
				"id",
				"discordId",
				"serverId",
				"verifycode",
				"email",
			] as const satisfies readonly UserProfileKey[];
			return option
				.setName("lookup")
				.setDescription("Key to lookup")
				.setRequired(true)
				.addChoices(
					...userProfileKeys.map((key) => ({ name: key, value: key })),
				);
		})
		.addStringOption((option) =>
			option
				.setName("string")
				.setDescription("String to lookup")
				.setRequired(true),
		);

export default async function command(
	interaction: ChatInputCommandInteraction,
) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	// the result has emails in it, so this is checked here too and not only by discord
	if (!(await HasPermission(interaction, PermissionFlagsBits.Administrator))) return;

	const lookup = interaction.options.getString(
		"lookup",
		true,
	) as UserProfileKey;
	const value = interaction.options.getString("string", true);

	// only profiles of this server
	const result = await FindByValue(lookup, value, interaction.guild.id);

	if (!result) {
		await interaction.editReply({
			content: "No user found with the given key and value.",
		});
		return;
	}

	const embed = new EmbedBuilder()
		.setTitle("User Found")
		.setDescription(`Result: <@${result.discordId}> (${getDisplayName(interaction.guild, result.discordId)})`)
		.setThumbnail(
			interaction.guild.members.cache
				.get(result.discordId)
				?.user.displayAvatarURL() ?? null,
		)
		.setAuthor({
			name: `Lookup for key:"${lookup}" with value:"${value}"`,
			iconURL: interaction.user.displayAvatarURL(),
		})
		.setColor("DarkNavy");

	for (const [key, val] of Object.entries(result)) {
		// the moderation list can get way too long for an embed
		const displayValue =
			key === "moderation" && Array.isArray(val)
				? `${val.length} entries (use /moderation history)`
				: typeof val === "object" && val !== null
					? JSON.stringify(val, null, 2)
					: String(val);
		if (displayValue === "null" || displayValue === "undefined") continue;
		embed.addFields({ name: key, value: displayValue.slice(0, 1024), inline: false });
	}

	await interaction.editReply({
		embeds: [embed],
	});
};
