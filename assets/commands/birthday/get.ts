import type { ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags } from "discord.js";
import { GetProfile } from "../../../utils/profileManager.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
		.setName("get")
		.setDescription("Gets your birthday")
		.setDescriptionLocalizations({
			"sv-SE": "Hämtar din födelsedag",
		})
		.addUserOption((option) =>
			option
				.setName("user")
				.setDescription("Get birthday for another user")
				.setRequired(false),
		);


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
