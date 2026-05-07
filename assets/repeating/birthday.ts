import type { Client, TextChannel } from "discord.js";
import { EmbedBuilder } from "discord.js";

import { FindAllNonNullKeys } from "../../utils/profileManager.js";

const repeating = {
	repeating: true,
	exactTime: "00:00",
	async execute(client: Client) {
		const birthdayChannel = client.channels.cache.get("1497140071659212845") as
			| TextChannel
			| undefined;
		if (!birthdayChannel) return;
		const date = new Date();

		const birthdayMembers = await FindAllNonNullKeys("birthday");
		const filteredMembers = birthdayMembers.filter((member) => {
            const birthday = (member.birthday as UserProfile["birthday"] | null);
			if (!birthday) return false;
			return (
				(birthday).month === date.getMonth() + 1 && (birthday).day === date.getDate()
			);
		});

		if (filteredMembers.length === 0) return;

		console.log(filteredMembers);
		const sortedMembers = filteredMembers.sort(
			(a, b) => {
				return ((b.birthday as UserProfile["birthday"])?.year || 0) - ((a.birthday as UserProfile["birthday"])?.year || 0);
			},
		);

		const embed = new EmbedBuilder()
			.setTitle("Happy Birthday!")
			.setDescription(
				sortedMembers
					.map(
						({ id, birthday }) => {
							const birthdayDate = birthday as UserProfile["birthday"] | null;
							return `<@${id}> - ${date.getFullYear() - (birthdayDate?.year || 0)} Years old`;
						},
					)
					.join("\n"),
			)
			.setColor(0xff0000);

		const response = await birthdayChannel.send({
			embeds: [embed],
			allowedMentions: { users: [] },
		});
		response.react("🎉").catch(() => null);
	},
};

export default repeating;
