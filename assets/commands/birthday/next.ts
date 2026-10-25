import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { GetNextBirthdays, GetSortedBirthdays } from "../../../utils/birthdayUtils.js";
import { GetDisplayName } from "../../../utils/memberUtils.js";
import { NumToMonth } from "../../../utils/stringConvert.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
		.setName("next")
		.setDescription("Shows the next birthday")
		.setDescriptionLocalizations({
			"sv-SE": "Visar nästa födelsedag",
		});

export default async function next(
	interaction: ChatInputCommandInteraction,
) {
	if (!interaction.guild) return;
	await interaction.deferReply({});
	const formattedList = await GetSortedBirthdays(interaction.guild);

	if (!formattedList || formattedList.length === 0) {
		await interaction.editReply({ content: "No birthdays have been set yet!" });
		return;
	}

	// Finds the next upcoming birthday, if none are upcoming get the first one next year
	const nextBirthdays = GetNextBirthdays(formattedList);
	if (!nextBirthdays) {
		await interaction.editReply({ content: "No birthdays have been set yet!" });
		return;
	}

	const { group, month, day, timestamp } = nextBirthdays;
	const shared = group.length > 1;

	// the names come from the cache
	await interaction.guild.members.fetch({ user: group.map((entry) => entry.user.discordId) }).catch(() => null);

	const displayNames = group
		.map((entry) => GetDisplayName(interaction.guild, entry.user.discordId))
		.filter((name): name is string => Boolean(name));

	const firstMemberId = group[0]?.user.discordId;
	const embed = new EmbedBuilder()
		.setTitle(`Next Birthday${shared ? "s" : ""}: ${NumToMonth(month)} ${day}`)
		.setThumbnail(
			firstMemberId
				? interaction.guild.members.cache.get(firstMemberId)?.displayAvatarURL() || null
				: null,
		)
		.setColor("Aqua")
		.setFooter({ text: `Use /birthday set to set your birthday!` })
		.setDescription(
			`The next birthday${shared ? "s" : ""} is ${shared ? `shared by: \n**${displayNames.join(", ")}**\n` : `**${displayNames[0] ?? "Someone"}**`} and will be <t:${timestamp}:R>`,
		);

	await interaction.editReply({
		embeds: [embed],
		allowedMentions: { users: [] },
	});
}
