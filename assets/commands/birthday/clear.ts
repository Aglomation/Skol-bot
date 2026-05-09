import type { ChatInputCommandInteraction, Client } from "discord.js";
import { MessageFlags } from "discord.js";
import { GetProfile, UpdateProfile } from "../../../utils/profileManager.js";

export default async function clear(
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

	await UpdateProfile(interaction.user.id, { birthday: null });

	await interaction.editReply({
		content: `Your birthday is cleared`,
	});
}
