import type { ButtonInteraction, GuildMember } from "discord.js";
import { MessageFlags } from "discord.js";

import { GetActiveBan } from "../../utils/moderationManager.js";
import { GetProfile } from "../../utils/profileManager.js";
import { BuildStep } from "../../utils/verifyFlow.js";

const button: Button = {
	data: {
		customId: "verify",
	},
	async execute(interaction: ButtonInteraction) {
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
		const profile = await GetProfile(interaction.user.id, interaction.guild.id) as UserProfile;

		if (GetActiveBan(profile)) {
			const member = interaction.member as GuildMember;
			if (!member) return;

			await member.kick();
			return;
		}

		await interaction.editReply(BuildStep("city", [], "verify"));
	},
};

export default button;
