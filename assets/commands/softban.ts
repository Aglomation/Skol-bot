import type {
	ChatInputCommandInteraction,
	Client,
	GuildMember,
	GuildTextBasedChannel,
	TextChannel,
} from "discord.js";
import {
	InteractionContextType,
	MessageFlags,
	PermissionFlagsBits,
	PermissionsBitField,
	SlashCommandBuilder,
} from "discord.js";

import { GetProfile, UpdateProfile } from "../../utils/profileManager.js";
import { purgeChannels } from "../../utils/purgeMessages.js";
import { stringToDate } from "../../utils/stringConvert.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("softban")
		.setDescription("Bans a user from the server (Softban)")
		.addUserOption((option) =>
			option
				.setName("user")
				.setDescription("User to softban")
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("reason")
				.setDescription("Reason for the ban")
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("duration")
				.setDescription("Duration of the ban (s, m, h, d, w, mo, y, inf)")
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("deletemessages")
				.setDescription("Whether to delete the user's messages")
				.setRequired(false)
				.setChoices(
					{ name: "1 Hour", value: "1h" },
					{ name: "3 Hours", value: "3h" },
					{ name: "6 Hours", value: "6h" },
					{ name: "12 Hours", value: "12h" },
					{ name: "1 Day", value: "24h" },
					{ name: "2 Days", value: "48h" },
				),
		)
		.addBooleanOption((option) =>
			option 
				.setName("announce")
				.setDescription("Whether to send the ban command publicly or not")
				.setRequired(false)
		)
		.setContexts(InteractionContextType.Guild)
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

	async execute(interaction: ChatInputCommandInteraction, client: Client) {
		if (interaction.options.getBoolean("announce")) {
			await interaction.deferReply();
		} else {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		}

		// Ensure interaction.member is treated as a GuildMember to access permissions
		const executor = interaction.member as GuildMember;

		if (!executor.permissions.has(PermissionsBitField.Flags.BanMembers)) {
			await interaction.editReply("You don't have permission to use this.");
			return;
		}
		const targetUser = interaction.options.getUser("user", true);
		const targetMember = interaction.options.getMember(
			"user",
		) as GuildMember | null;
		const reason = interaction.options.getString("reason", true);
		const date = stringToDate(interaction.options.getString("duration") || "");
		const deleteMessagesDuration = stringToDate(
			interaction.options.getString("deletemessages", false) || "",
		);

		const logChannel = client.channels.cache.get("1499149296203993169") as
			| TextChannel
			| undefined;

		const profile = await GetProfile(targetUser.id);

		if (!date) {
			await interaction.editReply("Invalid duration format. Make sure to follow the format!\nExample: `1h` for 1 hour, `30m` for 30 minutes, `inf` for indefinite.");
			return;
		}

		if (profile?.banned) {
			await interaction.editReply(
				"User is already on the ban list. Editing their ban instead.",
			);
			await UpdateProfile(targetUser.id, {
				banned: true,
				banreason: reason,
				banduration: String(Date.now() + date),
			});
			return;
		}

		if (!targetMember?.kickable) {
			await interaction.editReply(
				"I cannot softban this user. Their role is higher than or equal to my highest role, or they are the server owner.",
			);
			return;
		}
		try {
			await UpdateProfile(targetUser.id, {
				banned: true,
				banreason: reason,
				banduration: String(Date.now() + date),
			});

			const expiresAt = Number.isFinite(date)
				? Math.floor((Date.now() + date) / 1000)
				: null;
			await targetUser
				.send(
					`## You have been banned from ${interaction.guild?.name}\n` +
						`For: ${reason}\n` +
						`Duration: ${expiresAt ? `<t:${expiresAt}>` : "Indefinite"}\n` +
						`Expires: ${expiresAt ? `<t:${expiresAt}:R>` : "Indefinite"}\n` +
						`This dm can be used as a way to appeal, any messages sent will be seen by the staff team.` +
						`Invite: https://discord.gg/dUYHv8Dv94`,
				)
				.catch(() => {
					console.warn(
						`Could not send DM to ${targetUser.tag} (${targetUser.id}) about their softban.`,
					);
					return;
				});

			// Kicks instead of banning to avoid IP-ban
			if (targetMember) await targetMember.kick(reason);

			await interaction.editReply(`**${targetUser.tag}** has been banned.`);

			if (logChannel) {
				await logChannel.send(
					`${interaction.user.tag} has softbanned <@${targetUser.id}> until: ${expiresAt ? `<t:${expiresAt}>` : "Indefinite"} for the reason: ${reason}`,
				);
			}

			// Purge messages if option is set
			if (
				deleteMessagesDuration &&
				deleteMessagesDuration > 0 &&
				targetMember
			) {
				const channels = targetMember.guild.channels.cache.filter(
					(ch): ch is TextChannel =>
						ch.isTextBased() &&
						ch.permissionsFor(targetMember).has("ViewChannel"),
				);
				const channelsArray = channels.map((c) => c as GuildTextBasedChannel);

				const results = await purgeChannels(
					channelsArray,
					targetUser.id,
					deleteMessagesDuration,
				);

				if (logChannel)
					await logChannel.send(
						`Deleted ${results.reduce((acc, curr) => acc + curr, 0)} messages from <@${targetUser.id}> as part of the softban.`,
					);
			}
		} catch (err) {
			console.error(err);
			await interaction.editReply(
				`An error occurred while trying to softban the user. Please ensure I have the appropriate permissions and try again.\nError: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	},
};

export default command;
