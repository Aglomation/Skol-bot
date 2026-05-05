import { type Client, EmbedBuilder, type TextChannel } from "discord.js";
import { GetAllWithBirthday } from "../../utils/profileManager.js";

const repeating = {
	repeating: true,
	exactTime: "00:00",
	async execute(client: Client) {
		const birthdayChannel = client.channels.cache.get("1497140071659212845") as
			| TextChannel
			| undefined;
		if (!birthdayChannel) return;
		const date = new Date();

		const birthdayMembers = await GetAllWithBirthday();
		const filteredMembers = birthdayMembers.filter(({ birthday }) => {
			if (!birthday) return false;
			return (
				birthday.month === date.getMonth() + 1 && birthday.day === date.getDate()
			);
		});

		if (!filteredMembers) return;

		console.log(filteredMembers);
		const sortedMembers = filteredMembers.sort(
			(a, b) => (b.birthday?.year || 0) - (a.birthday?.year || 0),
		);

		const embed = new EmbedBuilder()
			.setTitle("Happy Birthday!")
			.setDescription(
				sortedMembers
					.map(
						({ id, birthday }) =>
							`<@${id}> - ${date.getFullYear() - (birthday?.year || 0)} Years old`,
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
