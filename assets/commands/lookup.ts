import type { ChatInputCommandInteraction, Client } from "discord.js";
import {
	EmbedBuilder,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from "discord.js";

import type { UserProfileKey } from "../../utils/profileManager.js";
import { FindByValue } from "../../utils/profileManager.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("lookup")
		.setDescription("String lookup for user profiles (for support only)")
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addStringOption((option) => {
			const userProfileKeys = [
				"id",
				"discordId",
				"serverId",
				"verifycode",
				"email",
				"banreason",
				"banduration",
			] as const satisfies readonly UserProfileKey[];
			return option
				.setName("lookup")
				.setDescription("Key to lookup")
				.setRequired(true)
				.addChoices(
					...userProfileKeys.map((key) => ({ name: key, value: key })),
				);
		})
		.addStringOption((option) =>
			option
				.setName("string")
				.setDescription("String to lookup")
				.setRequired(false),
		),

	async execute(interaction: ChatInputCommandInteraction, _client: Client) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const lookup = interaction.options.getString(
			"lookup",
			true,
		) as UserProfileKey;
		const value = interaction.options.getString("string", false);

		const result = await FindByValue(lookup, value);

		if (!result) {
			await interaction.editReply({
				content: "No user found with the given key and value.",
			});
			return;
		}

		const embed = new EmbedBuilder()
			.setTitle("User Found")
			.setDescription(`Result ID: <@${result.id}> (${result.id})`)
			.setThumbnail(
				interaction.guild?.members.cache
					.get(result.id)
					?.user.displayAvatarURL() || "",
			)
			.setAuthor({
				name: `Lookup for key:"${lookup}" with value:"${value}"`,
				iconURL: interaction.user.displayAvatarURL(),
			})
			.setColor("DarkNavy");

		for (const [key, val] of Object.entries(result)) {
			const displayValue =
				typeof val === "object" && val !== null
					? JSON.stringify(val, null, 2)
					: String(val);
			embed.addFields({ name: key, value: displayValue, inline: false });
		}

		await interaction.editReply({
			embeds: [embed],
		});
	},
};

export default command;
