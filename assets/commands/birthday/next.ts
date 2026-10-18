import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { GetNextBirthdays, sortedList } from "../../../utils/birthdayUtils.js";
import { getDisplayName } from "../../../utils/memberUtils.js";
import { numToMonth } from "../../../utils/stringConvert.js";

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
	const formattedList = await sortedList(interaction.guild);

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
		.map((entry) => getDisplayName(interaction.guild, entry.user.discordId))
		.filter((name): name is string => Boolean(name));

	const embed = new EmbedBuilder()
		.setTitle(`Next Birthday${shared ? "s" : ""}: ${numToMonth(month)} ${day}`)
		.setThumbnail(
			interaction.guild.members.cache
				.get(group[0].user.discordId)
				?.displayAvatarURL() || null,
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
