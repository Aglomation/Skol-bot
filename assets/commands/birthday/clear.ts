import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags } from "discord.js";
import { GetProfile, PROFILE_FAILED, UpdateProfile } from "../../../utils/profileManager.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("clear")
		.setDescription("Removes your birthday")
		.setDescriptionLocalizations({
			"sv-SE": "Tar bort din födelsedag",
		});

export default async function command(
	interaction: ChatInputCommandInteraction,
) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const profile = await GetProfile(interaction.user.id, interaction.guild.id);
	if (!profile?.birthday) {
		await interaction.editReply({ content: "You don't have a birthday set." });
		return;
	}

	const saved = await UpdateProfile(interaction.user.id, interaction.guild.id, { birthday: null });
	if (saved === PROFILE_FAILED) {
		await interaction.editReply({ content: "I couldn't clear your birthday, try again later." });
		return;
	}

	await interaction.editReply({ content: "Cleared your birthday." });
}
