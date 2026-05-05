import {
	type ChatInputCommandInteraction,
	type Client,
	type GuildMember,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
	type TextChannel,
} from "discord.js";
import { GetProfile, UpdateProfile } from "../../utils/profileManager.js";
import { stringToDate } from "../../utils/stringConvert.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("mute")
		.setDescription("Mutes a user (timeout)")
		.setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
		.addUserOption((option) =>
			option.setName("user").setDescription("User to mute").setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("reason")
				.setDescription("Reason for the mute")
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("duration")
				.setDescription(
					"Duration of the mute (s, m, h, d, mo, y, inf) [mutes >28d gets refreshed until <28d]",
				)
				.setRequired(true),
		),

	async execute(interaction: ChatInputCommandInteraction, client: Client) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		// Ensure interaction.member is treated as a GuildMember to access permissions
		const executor = interaction.member as GuildMember;

		if (!executor.permissions.has(PermissionFlagsBits.MuteMembers)) {
			await interaction.editReply("You don't have permission to use this.");
			return;
		}

		const user = interaction.options.getUser("user", true);
		const member = interaction.options.getMember("user") as GuildMember | null;
		const reason = interaction.options.getString("reason", true);
		const date = stringToDate(interaction.options.getString("duration") || "");

		if (!member) {
			await interaction.editReply("User is not in this server.");
			return;
		}

		if (!date) {
			await interaction.editReply("Invalid duration format.");
			return;
		}

		try {
			// If the duration is longer than 28 days it needs to be refreshed later.
			await member.timeout(
				Math.min(date, 28 * 24 * 60 * 60 * 1000 - 1000),
				reason,
			);

			await UpdateProfile(user.id, { timeout: Date.now() + date });

			const expiresAt = Number.isFinite(date)
				? Math.floor((Date.now() + date) / 1000)
				: null;
			await user
				.send(
					`## You have been muted from ${interaction.guild?.name}\n` +
					`For: ${reason}\n` +
					`Duration: ${expiresAt ? `<t:${expiresAt}>` : "Indefinite"}\n` +
					`Expires: ${expiresAt ? `<t:${expiresAt}:R>` : "Indefinite"}\n`,
				)
				.catch(() => { });

			await interaction.editReply(`**${user.tag}** has been muted.`);

			const logChannel = client.channels.cache.get("1499149296203993169") as
				| TextChannel
				| undefined;
			if (logChannel) {
				await logChannel.send(
					`${interaction.user.tag} has muted <@${user.id}> for the reason: ${reason}`,
				);
			}
		} catch (err) {
			console.error(err);
			await interaction.editReply(
				"I got an error while trying to mute that user. Make sure my role is high enough (or my code is just bad).",
			);
		}
	},
};

export default command;
