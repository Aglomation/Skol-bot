import type {
	ChatInputCommandInteraction,
	Client,
	GuildMember,
	GuildTextBasedChannel,
	TextChannel,
} from "discord.js";
import {
	MessageFlags,
	PermissionFlagsBits,
	PermissionsBitField,
	SlashCommandBuilder,
} from "discord.js";

import { GetProfile, UpdateProfile } from "../../utils/profileManager.js";
import { stringToDate } from "../../utils/stringConvert.js";
import { purgeChannels } from "../../utils/purgeMessages.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("softban")
		.setDescription("Bans a user from the server (Softban)")
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
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
				.setDescription("Duration of the ban (s, m, h, d, mo, y, inf)")
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("deletemessages")
				.setDescription("Whether to delete the user's messages")
				.setRequired(true)
				.setChoices(
					{ name: "1 Hour", value: "1h" },
					{ name: "6 Hours", value: "6h" },
					{ name: "12 Hours", value: "12h" },
					{ name: "24 Hours", value: "24h" },
					{ name: "None", value: "0h" },
				),
		),

	async execute(interaction: ChatInputCommandInteraction, client: Client) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		// Ensure interaction.member is treated as a GuildMember to access permissions
		const executor = interaction.member as GuildMember;

		if (!executor.permissions.has(PermissionsBitField.Flags.BanMembers)) {
			await interaction.editReply("You don't have permission to use this.");
			return;
		}
		const user = interaction.options.getUser("user", true);
		const member = interaction.options.getMember("user") as GuildMember | null;
		const reason = interaction.options.getString("reason", true);
		const date = stringToDate(interaction.options.getString("duration") || "a");
		const deleteMessagesDuration = stringToDate(
			interaction.options.getString("deletemessages", true) || "",
		);

		const logChannel = client.channels.cache.get("1499149296203993169") as
			| TextChannel
			| undefined;

		const profile = await GetProfile(user.id);
		if (profile?.banned) {
			await interaction.editReply("User is already on the ban list.");
			return;
		}

		if (!date) {
			await interaction.editReply("Invalid duration format.");
			return;
		}

		try {
			await UpdateProfile(user.id, {
				banned: true,
				banreason: reason,
				banduration: String(Date.now() + date),
			});

			const expiresAt = Number.isFinite(date)
				? Math.floor((Date.now() + date) / 1000)
				: null;
			await user
				.send(
					`## You have been banned from ${interaction.guild?.name}\n` +
						`For: ${reason}\n` +
						`Duration: ${expiresAt ? `<t:${expiresAt}>` : "Indefinite"}\n` +
						`Expires: ${expiresAt ? `<t:${expiresAt}:R>` : "Indefinite"}\n` +
						`Invite: https://discord.gg/dUYHv8Dv94`,
				)
				.catch(() => {});

			// Kicks instead of banning to avoid IP-ban
			if (member) await member.kick(reason);

			await interaction.editReply(`**${user.tag}** has been banned.`);

			if (logChannel) {
				await logChannel.send(
					`${interaction.user.tag} has softbanned <@${user.id}> until: ${expiresAt ? `<t:${expiresAt}>` : "Indefinite"} for the reason: ${reason}`,
				);
			}

			// Purge messages if option is set
			if (deleteMessagesDuration && deleteMessagesDuration > 0 && member) {
				await interaction.editReply(
					`Deleting messages from **${user.tag}** for the past ${interaction.options.getString("deletemessages", true)} as part of the softban.`,
				);
				const channels = member.guild.channels.cache.filter(
					(ch): ch is TextChannel =>
						ch.isTextBased() && ch.permissionsFor(member).has("ViewChannel"),
				);
				const channelsArray = channels.map((c) => c as GuildTextBasedChannel);

				const results = await purgeChannels(
					channelsArray,
					user.id,
					deleteMessagesDuration,
				);
				if (logChannel)
					await logChannel.send(
						`Deleted ${results.reduce((acc, curr) => acc + curr, 0)} messages from <@${user.id}> as part of the softban.`,
					);
				await interaction.editReply(
					`Deleted ${results.reduce((acc, curr) => acc + curr, 0)} messages from **${user.tag}** for the past ${interaction.options.getString("deletemessages", true)} as part of the softban.`,
				);
			}
		} catch (err) {
			console.error(err);
			await interaction.editReply(
				"I can't kick that user. They might have a higher role than me.",
			);
		}
	},
};

export default command;
