import type { ButtonInteraction, Client, GuildMember } from "discord.js";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	MessageFlags,
} from "discord.js";

import { GetProfile, UpdateProfile } from "../../utils/profileManager.js";

function generateRandomString(length: number) {
	// 36 ^ 5 = 60_466_176
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
		if (!interaction.guild) {
			// this should never happen, but ts was being angry about maybe being null
			await interaction.reply({
				content: "This button can only be used in a server.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
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

			if (!role) {
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

		// Generate a random 5 character verification code
		const verificationCode = profile?.verifycode
			? profile.verifycode
			: generateRandomString(5);

		// Store the verification code in the user's profile
		const updateResult = await UpdateProfile(interaction.user?.id, interaction.guild.id, { verifycode: verificationCode });
		if (updateResult === 1) {
			await interaction.editReply({
				content: `An error occurred while updating your profile. Please try again.`,
			});
			return;
		}

		const embed = new EmbedBuilder()
			.setTitle("⚠️ Viktigt")
			.setDescription(
				`Din webbläsare måste vara inloggad på ditt **@*lbs.se**-konto.\n\n` +
        		`Din kod för formuläret är: \`${verificationCode}\``
			)
			.setColor("#f2ff00");

		const button = new ButtonBuilder()
			.setLabel("Gå till formuläret")
			.setStyle(ButtonStyle.Link)
			.setURL(
				`https://docs.google.com/forms/d/e/1FAIpQLSdiCU7923760A1fP07hDDfgcrvUxUUQFd_yWAdXggellFVW9w/viewform?usp=pp_url&entry.952629899=${verificationCode}`,
			);

		await interaction.editReply({
			embeds: [embed],
			components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
		});
	},
};

export default button;
