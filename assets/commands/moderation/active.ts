import type { ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder } from "discord.js";
import { EmbedBuilder, MessageFlags, PermissionFlagsBits } from "discord.js";
import { GetActiveBan, GetActiveMute, GetModProfiles } from "../../../utils/moderationManager.js";
import { HasPermission, MakePages, SendPages, Time } from "./shared.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("active")
		.setDescription("See who is muted or softbanned right now");

export default async function command(
	interaction: ChatInputCommandInteraction,
	_client: Client,
) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	if (!(await HasPermission(interaction, PermissionFlagsBits.MuteMembers))) return;

	const profiles = await GetModProfiles(interaction.guild.id, ["mute", "softban"]);

	const lines: { at: number; text: string }[] = [];
	for (const profile of profiles) {
		const profileData = { moderation: profile.actions };

		const ban = GetActiveBan(profileData);
		if (ban) {
			lines.push({
				at: ban.action.at,
				text: `🔨 <@${profile.userId}> • banned ${ban.action.until ? `until ${Time(ban.action.until)}` : "forever"} (case #${ban.number})\n> ${ban.action.reason.slice(0, 200)}\n`,
			});
		}

		const mute = GetActiveMute(profileData);
		if (mute) {
			lines.push({
				at: mute.action.at,
				text: `🔇 <@${profile.userId}> • muted ${mute.action.until ? `until ${Time(mute.action.until)}` : "forever"} (case #${mute.number})\n> ${mute.action.reason.slice(0, 200)}\n`,
			});
		}
	}

	if (lines.length === 0) {
		await interaction.editReply("Nobody is muted or softbanned right now.");
		return;
	}

	// newest first
	lines.sort((a, b) => b.at - a.at);
	const pages = MakePages(lines.map((line) => line.text), 3000, 8);

	await SendPages(interaction, pages, (text, page, total) =>
		new EmbedBuilder()
			.setTitle("Active mutes and softbans")
			.setDescription(text)
			.setColor(0xE67E22)
			.setFooter({ text: `Page ${page + 1}/${total} • ${lines.length} active • based on the bot's history, not discord` }),
	);
}
