import type { ChatInputCommandInteraction, Client } from "discord.js";
import { MessageFlags } from "discord.js";
import { GetProfile } from "../../../utils/profileManager.js";

export default async function get(
	interaction: ChatInputCommandInteraction,
	_client: Client,
) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	const profile = await GetProfile(interaction.user.id);
	const birthday = profile?.birthday as UserProfile["birthday"] | null;
	if (!birthday)
		return await interaction.editReply({
			content: "You haven't set your birthday yet.",
		});

	await interaction.editReply({
		content: `Your birthday is set to ${birthday.year}-${String(birthday.month).padStart(2, "0")}-${String(birthday.day).padStart(2, "0")}`,
	});
}
