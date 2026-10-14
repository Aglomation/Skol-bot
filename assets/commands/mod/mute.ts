import type {
	ChatInputCommandInteraction,
	GuildMember,
	GuildTextBasedChannel,
	SlashCommandSubcommandBuilder,
	TextChannel,
} from "discord.js";
import {
	MessageFlags,
	PermissionFlagsBits,
} from "discord.js";
import { AddModAction, TimeoutLength, UntilFromDuration } from "../../../utils/moderationManager.js";
import { CheckHierarchy } from "../../../utils/permissions.js";
import { purgeChannels } from "../../../utils/purgeMessages.js";
import { parseDuration } from "../../../utils/stringConvert.js";
import { SendLog } from "../../../utils/logChannel.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
        .setName("mute")
		.setDescription("Mutes a user (timeout)")
		.addUserOption((option) =>
			option.setName("user").setDescription("User to mute").setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("reason")
				.setDescription("Reason for the mute")
				.setMaxLength(400)
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
				.setDescription("Whether to send the mute command publicly or not")
				.setRequired(false)
		);


export default async function command(
	interaction: ChatInputCommandInteraction
) {
	if (interaction.options.getBoolean("announce")) {
		await interaction.deferReply();
	} else {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	}
	if (!interaction.guild) {
		await interaction.editReply({
			content: "This command can only be used in a server.",
		});
		return;
	}
	// Ensure interaction.member is treated as a GuildMember to access permissions
	const executor = interaction.member as GuildMember;

	// a timeout is the moderate members permission, mute members is the voice mute
	if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers)) {
		await interaction.editReply("You don't have permission to use this.");
		return;
	}

	const user = interaction.options.getUser("user", true);
	const member = interaction.options.getMember("user") as GuildMember | null;
	const reason = interaction.options.getString("reason", true);
	const date = parseDuration(interaction.options.getString("duration") || "");
	const deleteMessagesDuration = parseDuration(
		interaction.options.getString("deletemessages", false) || "",
	);

	if (!member) {
		await interaction.editReply("User is not in this server.");
		return;
	}

	const denied = CheckHierarchy(executor, member);
	if (denied) {
		await interaction.editReply(denied);
		return;
	}

	if (!date) {
		await interaction.editReply("Invalid duration format. Make sure to follow the format!\nExample: `1h` for 1 hour, `30m` for 30 minutes, `inf` for indefinite.");
		return;
	}

	try {
		// If the duration is longer than 28 days it needs to be refreshed later.
		await member.timeout(TimeoutLength(UntilFromDuration(date)), reason);

		const expiresAt = Number.isFinite(date)
			? Math.floor((Date.now() + date) / 1000)
			: null;

		let dmSent = true;
		await user
			.send(
				`## You have been muted in ${interaction.guild?.name}\n` +
				`**Reason:** ${reason}\n` +
				`**Ends:** ${expiresAt ? `<t:${expiresAt}:F> (<t:${expiresAt}:R>)` : "Never (permanent)"}\n\n` +
				`Until then you can't send messages, react or speak in voice channels. If you think this is a mistake, reply to this message and the staff team will see it.`,
			)
			.catch(() => {
				dmSent = false;
			});

		// save it in the moderation history
		const caseNumber = await AddModAction(user.id, interaction.guild.id, {
			type: "mute",
			by: interaction.user.id,
			reason,
			until: UntilFromDuration(date),
			...(dmSent ? {} : { dm: false }),
		});

		await interaction.editReply(
			`**${user.tag}** has been muted. (case #${caseNumber ?? "?"})` +
				(caseNumber === null ? "\nI couldn't save the mute in the database, so it won't be refreshed or put back if they leave and join again." : ""),
		);

		await SendLog(interaction.client, interaction.guild.id, `${interaction.user.tag} has muted <@${user.id}> until: ${expiresAt ? `<t:${expiresAt}>` : "Indefinite"} for the reason: ${reason} (case #${caseNumber ?? "?"})`);

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

			await SendLog(interaction.client, interaction.guild.id, `Deleted ${results.reduce((acc, curr) => acc + curr, 0)} messages from <@${user.id}> as part of the mute.`);
		}
	} catch (err) {
		console.error(err);
		await interaction.editReply(
			"I got an error while trying to mute that user. Make sure my role is high enough (or my code is just bad).",
		);
	}
};