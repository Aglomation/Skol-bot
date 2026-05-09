import type { ChatInputCommandInteraction, Client } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { numToMonth } from "../../../utils/stringConvert.js";
import { sortedList } from "./main.js";

export default async function next(
	interaction: ChatInputCommandInteraction,
	_client: Client,
) {
	await interaction.deferReply({});
	const formattedList = await sortedList();

	if (!formattedList || formattedList.length === 0) {
		await interaction.editReply({ content: "No birthdays have been set yet!" });
		return;
	}
	const today = new Date();
	const nextBirthday = formattedList
		.map(({ user, birthday }) => {
			if (!birthday) return null;
			return birthday.month > today.getMonth() + 1 ||
				(birthday.month === today.getMonth() + 1 &&
					birthday.day > today.getDate())
				? { user, birthday }
				: { user, birthday: { ...birthday, month: birthday.month + 12 } };
		})
		.sort((a, b) => {
			if (!a || !b) return 0;
			return (
				a.birthday.month - b.birthday.month || a.birthday.day - b.birthday.day
			);
		})
		.filter((entry) => entry !== null)[0];

	if (!nextBirthday) {
		await interaction.editReply({
			content: "No upcoming birthdays found until next year!",
		});
		return;
	}

	const nextBirthdayAge = new Date().getFullYear() - nextBirthday.birthday.year;
	const nextBirthdayTimestamp = Math.floor(
		new Date(
			today.getFullYear(),
			(nextBirthday.birthday?.month || 1) - 1,
			nextBirthday.birthday?.day || 1,
		).getTime() / 1000,
	);
	const embed = new EmbedBuilder()
		.setTitle(
			`Next Birthday: ${numToMonth(nextBirthday.birthday?.month || 0)} ${nextBirthday.birthday?.day}`,
		)
		.setThumbnail(
			interaction.guild?.members.cache
				.get(nextBirthday?.user.id)
				?.displayAvatarURL() || null,
		)
		.setColor("Aqua")
		.setFooter({ text: `Use /birthday set to set your birthday!` })
		.setDescription(
			`The next birthday is <@${nextBirthday?.user.id}>'s who turns ${nextBirthdayAge} years old <t:${nextBirthdayTimestamp}:R>`,
		);

	await interaction.editReply({
		embeds: [embed],
		allowedMentions: { users: [] },
	});
}
