import type { ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder, TextChannel } from "discord.js";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { GetServerConfig } from "../../../utils/configManager.js";
import { GetActiveMute, IgnoreTimeoutChange, VoidModAction } from "../../../utils/moderationManager.js";
import { GetProfile } from "../../../utils/profileManager.js";
import { HasPermission, TYPE_INFO } from "./shared.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("void")
		.setDescription("Void a case, it stays in the history but doesn't count anymore")
		.addUserOption((option) =>
			option.setName("user").setDescription("User the case is about").setRequired(true),
		)
		.addIntegerOption((option) =>
			option
				.setName("case")
				.setDescription("The case number (#1, #2...) from /moderation history")
				.setMinValue(1)
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("reason")
				.setDescription("Why it's being voided")
				.setRequired(true),
		);

export default async function command(
	interaction: ChatInputCommandInteraction,
	client: Client,
) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	// voiding someone elses case needs more than just being able to mute
	if (!(await HasPermission(interaction, PermissionFlagsBits.BanMembers))) return;

	const user = interaction.options.getUser("user", true);
	const caseNumber = interaction.options.getInteger("case", true);
	const reason = interaction.options.getString("reason", true);

	const profile = await GetProfile(user.id, interaction.guild.id);
	const entry = profile?.moderation[caseNumber - 1];

	if (!entry) {
		await interaction.editReply(`**${user.tag}** doesn't have a case #${caseNumber}.`);
		return;
	}

	if (entry.voided) {
		await interaction.editReply(`Case #${caseNumber} is already voided.`);
		return;
	}

	// check this before voiding, afterwards it doesnt count anymore
	const wasActiveMute = GetActiveMute(profile)?.number === caseNumber;

	const voided = await VoidModAction(user.id, interaction.guild.id, caseNumber, interaction.user.id, reason);
	if (!voided) {
		await interaction.editReply("I couldn't void that case, check the console.");
		return;
	}

	// voiding a mute that is still going also removes the timeout in discord
	let extra = "";
	if (wasActiveMute) {
		const member = await interaction.guild.members.fetch(user.id).catch(() => null);
		IgnoreTimeoutChange(user.id);
		const removed = await member?.timeout(null, `Mute voided by ${interaction.user.tag}`).then(() => true).catch(() => false);
		extra = removed ? "\nTheir timeout was removed too." : "\nI couldn't remove their timeout, use /unmute if they are still muted.";
	}

	await interaction.editReply(`Voided case #${caseNumber} (${TYPE_INFO[entry.type].label}) for **${user.tag}**.${extra}`);

	const logChannel = client.channels.cache.get(
		await GetServerConfig(interaction.guild.id, "logChannel") as string
	) as TextChannel | undefined;

	if (logChannel) {
		await logChannel.send(
			`${interaction.user.tag} voided case #${caseNumber} (${TYPE_INFO[entry.type].label}) for <@${user.id}> for the reason: ${reason}`,
		);
	}
}
