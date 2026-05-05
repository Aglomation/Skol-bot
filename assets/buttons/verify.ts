import { type ButtonInteraction, type Client, MessageFlags } from "discord.js";
import { GetProfile, UpdateProfile } from "../../utils/profileManager.js";

function generateRandomString(length: number) {
	// 36 ^ 4 = 1,679,616
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
	let result = "";
	for (let i = 0; i < length; i++) {
		const randomIndex = Math.floor(Math.random() * chars.length);
		result += chars[randomIndex];
	}
	return result;
}

const button: Button = {
	data: {
		customId: "verify",
	},
	async execute(interaction: ButtonInteraction, _client: Client) {
		if (interaction.channel?.id !== "1498834244854878209") return;

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const profile = await GetProfile(interaction.user.id);
		if (profile?.banned === true) {
			const member = await interaction.guild?.members
				.fetch(interaction.user.id)
				.catch(() => null);
			if (!member) return;

			await member.kick();
			return;
		}

		// Give verified role immediately if the user already has an email connected
		if (profile?.email) {
			const member = await interaction.guild?.members
				.fetch(interaction.user.id)
				.catch(() => null);
			if (!member) return;

			const role = await interaction.guild?.roles
				.fetch("1498832228145168514")
				.catch(() => null);
			if (!role) return;

			await member.roles.add(role);
			return;
		}

		// Generates random code and adds it to users profile
		const verificationCode = generateRandomString(4);
		await UpdateProfile(interaction.user?.id, { verifycode: verificationCode });

		await interaction.editReply({
			content: `Your code is: \`${verificationCode}\`\nMake sure you use your school mail!\nPlease enter the code in the form below\nhttps://forms.gle/b6UgMMjASMrhhRZ3A`,
		});
	},
};

export default button;
