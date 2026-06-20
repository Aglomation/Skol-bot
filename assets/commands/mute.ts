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
	SlashCommandBuilder,
} from "discord.js";

import { UpdateProfile } from "../../utils/profileManager.js";
import { purgeChannels } from "../../utils/purgeMessages.js";
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
					"Duration of the mute (s, m, h, d, w, mo, y, inf) [mutes >28d gets refreshed until <28d]",
				)
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
		.setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers),

	async execute(interaction: ChatInputCommandInteraction, client: Client) {
		if (interaction.options.getBoolean("announce")) {
			await interaction.deferReply();
		} else {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		}
		
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
		const deleteMessagesDuration = stringToDate(
			interaction.options.getString("deletemessages", false) || "",
		);

		if (!member) {
			await interaction.editReply("User is not in this server.");
			return;
		}

		if (!date) {
			await interaction.editReply("Invalid duration format. Make sure to follow the format!\nExample: `1h` for 1 hour, `30m` for 30 minutes, `inf` for indefinite.");
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
						`Expires: ${expiresAt ? `<t:${expiresAt}:R>` : "Indefinite"}\n` +
						`This dm can be used as a way to appeal, any messages sent will be seen by the staff team.`,
				)
				.catch(() => {});

			await interaction.editReply(`**${user.tag}** has been muted.`);

			const logChannel = client.channels.cache.get("1499149296203993169") as
				| TextChannel
				| undefined;
			if (logChannel) {
				await logChannel.send(
					`${interaction.user.tag} has muted <@${user.id}> until: ${expiresAt ? `<t:${expiresAt}>` : "Indefinite"} for the reason: ${reason}`,
				);
			}

			// Purge messages if option is set
			if (deleteMessagesDuration && deleteMessagesDuration > 0 && member) {
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
						`Deleted ${results.reduce((acc, curr) => acc + curr, 0)} messages from <@${user.id}> as part of the mute.`,
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
