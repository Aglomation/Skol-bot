import type { ChatInputCommandInteraction, Client } from "discord.js";
import { MessageFlags } from "discord.js";
import { GetProfile } from "../../../utils/profileManager.js";

export default async function get(
	interaction: ChatInputCommandInteraction,
	_client: Client,
) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const profile = await GetProfile(
		interaction.options.getUser("user")?.id || interaction.user.id,
	);

	const birthday = profile?.birthday as UserProfile["birthday"] | null;

	if (!birthday)
		return await interaction.editReply({
			content: "User haven't set their birthday yet.",
		});

	await interaction.editReply({
		content: `User's birthday is set to ${birthday.year}-${String(birthday.month).padStart(2, "0")}-${String(birthday.day).padStart(2, "0")}`,
	});
}
