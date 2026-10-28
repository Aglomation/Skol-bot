import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder, User } from "discord.js";
import { EmbedBuilder, MessageFlags } from "discord.js";
import { FormatBirthday } from "../../../utils/birthdayUtils.js";
import { GetDisplayName } from "../../../utils/memberUtils.js";
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
) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	const user = interaction.options.getUser("user") || interaction.user as User;
	const profile = await GetProfile(
		user.id,
		interaction.guild?.id as string
	);

	const birthday = profile?.birthday as UserProfile["birthday"] | null;

	// 0 is a real date (1970-01-01)
	if (birthday == null)
		return await interaction.editReply({
			content: "That user hasn't set their birthday yet.",
		});

	// the name is only found for members the bot has cached
	const name = GetDisplayName(interaction.guild, user.id) ?? user.displayName;

	const embed = new EmbedBuilder()
		.setTitle(`${name}'s Birthday`)
		.setDescription(`${name}'s birthday is set to ${FormatBirthday(birthday)}`)
		.setThumbnail(user.displayAvatarURL())
		.setColor("Aqua")
		.setFooter({ text: `Use /birthday set to set your birthday!` });

	await interaction.editReply({
		embeds: [embed]
	});
}
