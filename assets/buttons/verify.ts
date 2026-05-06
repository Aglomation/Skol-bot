import type { ButtonInteraction, Client, GuildMember } from "discord.js";
import { MessageFlags } from "discord.js";

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
		if (interaction.channel?.id !== "1499407739292749955") return;

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		// In case the autoban failed, check an extra time
		const profile = await GetProfile(interaction.user.id);
		if (profile?.banned === true) {
			const member = interaction.member as GuildMember;
			if (!member) return;

			await member.kick();
			return;
		}

		// Give verified role immediately if the user already has an email connected
		if (profile?.email) {
			const member = interaction.member as GuildMember;
			if (!member) return;
			const role = interaction.guild?.roles.cache.get("1498832228145168514");

			if (!role){
				await interaction.editReply({
					content: `An error occurred while assigning the role, please contact an administrator.`,
				});
				return;
			}

			await member.roles.add(role);
			await interaction.editReply({
				content: `You have been verified successfully!`,
			});
			return;
		}

		const verificationCode = profile?.verifycode ? profile.verifycode : generateRandomString(4);

		await UpdateProfile(interaction.user?.id, { verifycode: verificationCode });

		await interaction.editReply({
			content: `Your code is: \`${verificationCode}\`\nMake sure you use your school mail!\nPlease enter the code in the form below\nhttps://forms.gle/b6UgMMjASMrhhRZ3A`,
		});
	},
};

export default button;
