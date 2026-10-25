import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { GetSortedBirthdays, HasBirthYear, IsBirthdayOn, TodayInSweden } from "../../../utils/birthdayUtils.js";
import { GetDisplayName } from "../../../utils/memberUtils.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("today")
		.setDescription("Shows who has a birthday today")
		.setDescriptionLocalizations({
			"sv-SE": "Visar vem som fyller år idag",
		});

export default async function today(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) return;
	await interaction.deferReply();

	const date = TodayInSweden();
	const matches = ((await GetSortedBirthdays(interaction.guild)) ?? []).filter(
		(entry) => entry.birthday && IsBirthdayOn(entry.birthday, date),
	);

	await interaction.guild.members.fetch({ user: matches.map((entry) => entry.user.discordId) }).catch(() => null);

	const lines = matches.flatMap(({ user, birthday }) => {
		const name = GetDisplayName(interaction.guild, user.discordId);
		if (!name || !birthday) return [];
		return `🎂 **${name}**${HasBirthYear(birthday) ? ` turns ${date.year - birthday.year}` : ""}`;
	});

	if (lines.length === 0) {
		await interaction.editReply({ content: "Nobody has a birthday today." });
		return;
	}

	const embed = new EmbedBuilder()
		.setTitle("Birthdays today")
		.setColor("Aqua")
		.setDescription(lines.join("\n"))
		.setFooter({ text: "Use /birthday set to set your birthday!" });

	await interaction.editReply({ embeds: [embed], allowedMentions: { users: [] } });
}
