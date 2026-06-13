import type { ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder, User } from "discord.js";
import { EmbedBuilder, MessageFlags } from "discord.js";
import { getDisplayName } from "../../../utils/memberUtils.js";
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
	const user = interaction.options.getUser("user") || interaction.user as User;
	const profile = await GetProfile(
		user.id,
	);
	console.log(profile);
	const birthday = profile?.birthday as UserProfile["birthday"] | null;

	if (!birthday)
		return await interaction.editReply({
			content: "User haven't set their birthday yet.",
		});

	const embed = new EmbedBuilder()
		.setTitle(`${getDisplayName(interaction.guild, user.id)}'s Birthday`)
		.setDescription(`${getDisplayName(interaction.guild, user.id)}'s birthday is set to <t:${birthday}:D>`)
		.setThumbnail(user.displayAvatarURL())
		.setColor("Aqua")
		.setFooter({ text: `Use /birthday set to set your birthday!` });

	await interaction.editReply({
		embeds: [embed]
	});
}
