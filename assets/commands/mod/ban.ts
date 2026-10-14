import type {
	ChatInputCommandInteraction,
	GuildMember,
	GuildTextBasedChannel,
	SlashCommandSubcommandBuilder,
	TextChannel,
} from "discord.js";
import {
	MessageFlags,
	PermissionsBitField,
} from "discord.js";
import { AddModAction, GetActiveBan, UntilFromDuration } from "../../../utils/moderationManager.js";
import { CheckHierarchy } from "../../../utils/permissions.js";
import { GetProfile } from "../../../utils/profileManager.js";
import { purgeChannels } from "../../../utils/purgeMessages.js";
import { parseDuration } from "../../../utils/stringConvert.js";
import { SendLog } from "../../../utils/logChannel.js";


export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
		.setName("ban")
		.setDescription("Bans a user from the server (ban)")
		.addUserOption((option) =>
			option
				.setName("user")
				.setDescription("User to ban")
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("reason")
				.setDescription("Reason for the ban")
				.setMaxLength(400)
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
					{ name: "None", value: "0" },
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
		);

export default async function command(
	interaction: ChatInputCommandInteraction
) {
	if (!interaction.guild) {
		await interaction.reply({
			content: "This command can only be used in a server.",
			flags: MessageFlags.Ephemeral,
		});
		return;
	}
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
	const date = parseDuration(interaction.options.getString("duration") || "");
	const deleteMessagesDuration = parseDuration(
		interaction.options.getString("deletemessages", false) || "",
	);

	// nobody bans themselves or the bot, and a moderator can't ban someone who ranks as high as them or higher
	if (targetUser.id === interaction.user.id || targetUser.id === interaction.client.user?.id) {
		await interaction.editReply("You can't do that to yourself or to me.");
		return;
	}
	const denied = targetMember ? CheckHierarchy(executor, targetMember) : null;
	if (denied) {
		await interaction.editReply(denied);
		return;
	}

	const profile = await GetProfile(targetUser.id, interaction.guild.id);

	if (!date) {
		await interaction.editReply("Invalid duration format. Make sure to follow the format!\nExample: `1h` for 1 hour, `30m` for 30 minutes, `inf` for indefinite.");
		return;
	}

	const expiresAt = Number.isFinite(date)
		? Math.floor((Date.now() + date) / 1000)
		: null;

	// already banned, the new ban replaces the old one (the old one stays in the history)
	if (GetActiveBan(profile)) {
		// dm first so we know if it arrived before saving the case
		let editDmSent = true;
		await targetUser
			.send(
				`## Your ban on ${interaction.guild?.name} has been changed\n` +
				`**New reason:** ${reason}\n` +
				`**Now ends:** ${expiresAt ? `<t:${expiresAt}:F> (<t:${expiresAt}:R>)` : "Never (permanent)"}\n\n` +
				`You still can't join the server while the ban is active. If you think this is a mistake, reply to this message and the staff team will see it.`,
			)
			.catch(() => {
				console.warn(
					`Could not send DM to ${targetUser.tag} (${targetUser.id}) about their ban.`,
				);
				editDmSent = false;
			});

		const editNumber = await AddModAction(targetUser.id, interaction.guild.id, {
			type: "softban",
			by: interaction.user.id,
			reason,
			until: UntilFromDuration(date),
			...(editDmSent ? {} : { dm: false }),
		});
		if (editNumber === null) {
			await interaction.editReply("I couldn't save the change in the database, so the ban is the same as before. They may have gotten the dm, try again.");
			return;
		}

		// someone with an active ban shouldn't be in the server, it happens if they joined while the bot or the database was down
		let stillInServer = "";
		if (targetMember) {
			stillInServer = await targetMember
				.kick(reason)
				.then(() => "\nThey were still in the server, so I kicked them.")
				.catch(() => "\nThey are still in the server and I couldn't kick them, do it by hand.");
		}

		await interaction.editReply(
			`User is already on the ban list. Edited their ban instead. (case #${editNumber})${stillInServer}`,
		);

		SendLog(interaction.client, interaction.guild.id, `${interaction.user.tag} has edited the ban of <@${targetUser.id}>, now until: ${expiresAt ? `<t:${expiresAt}>` : "Indefinite"} for the reason: ${reason} (case #${editNumber})`);
		return;
	}

	// no member means they arent in the server, thats fine, its a preban and they get kicked when they join
	if (targetMember && !targetMember.kickable) {
		await interaction.editReply(
			"I cannot ban this user. Their role is higher than or equal to my highest role, or they are the server owner.",
		);
		return;
	}

	try {
		let dmSent = true;
		await targetUser
			.send(
				`## You have been banned from ${interaction.guild?.name}\n` +
				`**Reason:** ${reason}\n` +
				`**Ends:** ${expiresAt ? `<t:${expiresAt}:F> (<t:${expiresAt}:R>)` : "Never (permanent)"}\n\n` +
				`You can't join the server while the ban is active. If you think this is a mistake, reply to this message and the staff team will see it.` +
				(expiresAt ? `\nYou can rejoin when it ends: https://discord.gg/dUYHv8Dv94` : ""),
			)
			.catch(() => {
				console.warn(
					`Could not send DM to ${targetUser.tag} (${targetUser.id}) about their ban.`,
				);
				dmSent = false;
			});

		// get the channels to purge before the kick, after it we cant check what they could see
		const channelsToPurge =
			targetMember && deleteMessagesDuration && deleteMessagesDuration > 0
				? targetMember.guild.channels.cache
						.filter((ch) => ch.isTextBased() && ch.permissionsFor(targetMember)?.has("ViewChannel"))
						.map((c) => c as GuildTextBasedChannel)
				: [];

		// save it in the moderation history (before the kick so they cant rejoin in between)
		const caseNumber = await AddModAction(targetUser.id, interaction.guild.id, {
			type: "softban",
			by: interaction.user.id,
			reason,
			until: UntilFromDuration(date),
			...(dmSent ? {} : { dm: false }),
		});

		// without a saved case the ban doesn't exist, they would be able to join again
		if (caseNumber === null) {
			await interaction.editReply("I couldn't save the ban in the database, so I didn't kick them. They may have gotten the ban dm, try again.");
			return;
		}

		// Kicks instead of banning to avoid IP-ban
		// the ban is saved, so if the kick fails they are kicked when they join the next time
		let kickFailed = false;
		if (targetMember) {
			await targetMember.kick(reason).catch((err) => {
				console.error(`Could not kick ${targetUser.tag} after saving the ban:`, err);
				kickFailed = true;
			});
		}

		await interaction.editReply(
			`**${targetUser.tag}** has been banned. (case #${caseNumber})` +
				(targetMember ? "" : "\nThey are not in the server, they will be kicked if they join.") +
				(kickFailed ? "\nThe ban is saved but I couldn't kick them, do it by hand." : ""),
		);

		await SendLog(interaction.client, interaction.guild.id, `${interaction.user.tag} has banned <@${targetUser.id}> until: ${expiresAt ? `<t:${expiresAt}>` : "Indefinite"} for the reason: ${reason} (case #${caseNumber})`);

		// Purge messages if option is set
		if (channelsToPurge.length > 0 && deleteMessagesDuration) {
			const results = await purgeChannels(
				channelsToPurge,
				targetUser.id,
				deleteMessagesDuration,
			);

			await SendLog(interaction.client, interaction.guild.id, `Deleted ${results.reduce((acc, curr) => acc + curr, 0)} messages from <@${targetUser.id}> as part of the ban.`);
		}
	} catch (err) {
		console.error(err);
		await interaction.editReply(
			`An error occurred while trying to ban the user. Please ensure I have the appropriate permissions and try again.\nError: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
};