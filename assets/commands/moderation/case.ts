import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { EmbedBuilder, MessageFlags, PermissionFlagsBits } from "discord.js";
import { HasPermission } from "../../../utils/permissions.js";
import { GetProfile } from "../../../utils/profileManager.js";
import { Time, TYPE_INFO } from "./shared.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("case")
		.setDescription("See one case in full, with the whole reason")
		.addUserOption((option) =>
			option.setName("user").setDescription("User the case is about").setRequired(true),
		)
		.addIntegerOption((option) =>
			option
				.setName("case")
				.setDescription("The case number (#1, #2...) from /moderation history")
				.setMinValue(1)
				.setRequired(true),
		);

export default async function command(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	if (!(await HasPermission(interaction, PermissionFlagsBits.ModerateMembers))) return;

	const user = interaction.options.getUser("user", true);
	const caseNumber = interaction.options.getInteger("case", true);

	const profile = await GetProfile(user.id, interaction.guild.id);
	const action = profile?.moderation[caseNumber - 1];

	if (!action) {
		await interaction.editReply(`**${user.tag}** doesn't have a case #${caseNumber}.`);
		return;
	}

	const info = TYPE_INFO[action.type];
	const embed = new EmbedBuilder()
		.setTitle(`Case #${caseNumber} • ${info.emoji} ${info.label}`)
		.setColor(info.color)
		.setDescription((action.reason || "No reason").slice(0, 4000))
		.addFields(
			{ name: "User", value: `<@${user.id}>`, inline: true },
			{ name: "Moderator", value: action.by ? `<@${action.by}>` : "Unknown", inline: true },
			{ name: "When", value: `${Time(action.at, "F")} (${Time(action.at, "R")})`, inline: false },
		);

	if (action.until !== undefined) {
		embed.addFields({ name: action.until === null || action.until > Date.now() ? "Ends" : "Ended", value: action.until === null ? "Never" : Time(action.until, "F"), inline: true });
	}
	if (action.dm === false) embed.addFields({ name: "Direct message", value: "Could not be sent", inline: true });
	if (action.voided) {
		embed.addFields({ name: "🚫 Voided", value: `By <@${action.voided.by}> ${Time(action.voided.at, "R")}\n${action.voided.reason.slice(0, 900)}` });
	}

	await interaction.editReply({ embeds: [embed] });
}
