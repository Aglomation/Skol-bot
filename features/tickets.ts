import type { ButtonInteraction, Guild, GuildBasedChannel, GuildMember, Message, TextChannel, User } from "discord.js";
import {
	ActionRowBuilder,
	AttachmentBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	Colors,
	EmbedBuilder,
	MessageFlags,
	OverwriteType,
	PermissionFlagsBits,
} from "discord.js";
import { GetServerConfig } from "../utils/configManager.js";
import { ExplainError, SafeError } from "../utils/errorText.js";
import { SendLog, SendToChannel } from "../utils/logChannel.js";
import { IsStaff } from "../utils/permissions.js";

export const TICKET_BUTTON_ID = "ticket";

const MAX_CHANNELS_IN_CATEGORY = 50;

const MAX_TRANSCRIPT_PAGES = 10;

// what the owner and the mods can do in a ticket
const TICKET_PERMISSIONS = [
	PermissionFlagsBits.ViewChannel,
	PermissionFlagsBits.SendMessages,
	PermissionFlagsBits.ReadMessageHistory,
	PermissionFlagsBits.AttachFiles,
	PermissionFlagsBits.EmbedLinks,
];

export interface TicketTopicData {
	ownerId: string | null;
	displayName: string | null;
	claimerId: string | null;
}

const TOPIC_ID = /^\d{15,25}$/;

/**
 * Reads the topic of a ticket channel ("ticket:<owner> | displayName:<name> | claimed:<staff>")
 * The ids have to be real ids, the topic can be edited by anyone with Manage Channels
 */
export function ParseTicketTopic(topic: string | null | undefined): TicketTopicData {
	const data: TicketTopicData = { ownerId: null, displayName: null, claimerId: null };
	if (!topic) return data;

	for (const part of topic.split("|").map((item) => item.trim())) {
		if (part.startsWith("ticket:")) {
			const id = part.slice("ticket:".length).trim();
			if (TOPIC_ID.test(id)) data.ownerId = id;
		} else if (part.startsWith("displayName:")) {
			data.displayName = part.slice("displayName:".length).trim() || null;
		} else if (part.startsWith("claimed:")) {
			const id = part.slice("claimed:".length).trim();
			if (TOPIC_ID.test(id)) data.claimerId = id;
		}
	}

	return data;
}

/**
 * Writes the topic of a ticket channel, only when it changed because discord rate limits topic changes hard
 */
async function SaveTicketTopic(channel: TextChannel, data: TicketTopicData): Promise<void> {
	const parts: string[] = [];

	if (data.ownerId) parts.push(`ticket:${data.ownerId}`);
	// the topic is split on | so it can't be in the name
	if (data.displayName) parts.push(`displayName:${data.displayName.replace(/\|/g, "/")}`);
	if (data.claimerId) parts.push(`claimed:${data.claimerId}`);

	const topic = parts.join(" | ");
	if (topic !== channel.topic) await channel.setTopic(topic);
}

/**
 * Who opened the ticket
 * @returns null if it isn't a ticket
 */
export function GetTicketOwner(channel: GuildBasedChannel): string | null {
	if (channel.type !== ChannelType.GuildText) return null;

	return ParseTicketTopic(channel.topic).ownerId;
}

/**
 * A ticket is a text channel in the ticket category that has an owner in its topic
 * Other channels an admin put in the category are not tickets, so nobody can close them
 */
export function IsTicketChannel(channel: GuildBasedChannel, categoryId: string): channel is TextChannel {
	return channel.type === ChannelType.GuildText && channel.parentId === categoryId && GetTicketOwner(channel) !== null;
}

/**
 * The staff member who took the ticket, it is kept in the topic after the owner
 */
export function GetTicketClaimer(channel: TextChannel): string | null {
	return ParseTicketTopic(channel.topic).claimerId;
}

export async function SetTicketClaimer(channel: TextChannel, userId: string | null): Promise<void> {
	const data = ParseTicketTopic(channel.topic);
	data.claimerId = userId;
	await SaveTicketTopic(channel, data);
}

/**
 * A closed ticket is one where the owner can't write anymore, closing it stops everyone, so this is not kept in the topic
 */
export function IsTicketClosed(channel: TextChannel): boolean {
	const ownerId = GetTicketOwner(channel);
	if (!ownerId) return false;

	return channel.permissionOverwrites.cache.get(ownerId)?.deny.has(PermissionFlagsBits.SendMessages) ?? false;
}

export function BuildClosedRows(): ActionRowBuilder<ButtonBuilder>[] {
	return [
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setCustomId(`${TICKET_BUTTON_ID}:delete`).setLabel("Delete ticket").setEmoji("🗑️").setStyle(ButtonStyle.Danger),
			new ButtonBuilder().setCustomId(`${TICKET_BUTTON_ID}:open`).setLabel("Open ticket").setEmoji("🔓").setStyle(ButtonStyle.Success),
		),
	];
}

export function BuildTicketRows(claimed: boolean): ActionRowBuilder<ButtonBuilder>[] {
	return [
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setCustomId(`${TICKET_BUTTON_ID}:close`).setLabel("Close ticket").setEmoji("🔒").setStyle(ButtonStyle.Danger),
			new ButtonBuilder()
				.setCustomId(`${TICKET_BUTTON_ID}:claim`)
				.setLabel(claimed ? "Unclaim" : "Claim")
				.setEmoji("✋")
				.setStyle(ButtonStyle.Secondary),
		),
	];
}

/**
 * Finds the ticket someone is using a command or button in, and checks that they are allowed to
 * @param staffOnly Only the staff can do it, the owner of the ticket can't
 * @returns The ticket, or why it isn't allowed
 */
export async function GetTicketForMember(guild: Guild, channelId: string, member: GuildMember, staffOnly = false, allowClosed = false): Promise<TextChannel | string> {
	const categoryId = await GetServerConfig(guild.id, "ticketCategory");
	const channel = guild.channels.cache.get(channelId);
	if (!categoryId || !channel || !IsTicketChannel(channel, categoryId)) return "This isn't a ticket.";
	if (IsTicketClosed(channel) && !allowClosed) return "This ticket is closed.";

	const isOwner = GetTicketOwner(channel) === member.id;
	if ((staffOnly || !isOwner) && !(await IsStaff(member))) {
		return staffOnly ? "Only the staff can do that." : "Only the owner of the ticket and the staff can do that.";
	}

	return channel;
}

// a name for the channel, only letters, numbers and - are left
export function Slug(name: string): string {
	return name
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80) || "user";
}

// The role that is pinged when a ticket is opened, leave it empty to ping nobody
const TICKET_PING_ROLE_ID: string = "1560617409998757992";

/** What the bot needs in the ticket category to make the channels */
const BOT_PERMISSIONS_IN_CATEGORY = [
	PermissionFlagsBits.ViewChannel,
	PermissionFlagsBits.SendMessages,
	PermissionFlagsBits.ManageChannels,
	PermissionFlagsBits.ManageRoles,
];

/**
 * The ticket category of the server, if it is set up and the bot can work in it
 * Tells the person what is wrong when it is not
 */
async function FindTicketCategory(interaction: ButtonInteraction, guild: Guild) {
	const categoryId = await GetServerConfig(guild.id, "ticketCategory");
	const category = categoryId ? guild.channels.cache.get(categoryId) : undefined;
	if (!category || category.type !== ChannelType.GuildCategory) {
		await interaction.editReply("Tickets aren't set up in this server, please contact a moderator.");
		return null;
	}

	const botMember = guild.members.me;
	if (!botMember || !category.permissionsFor(botMember).has(BOT_PERMISSIONS_IN_CATEGORY)) {
		await interaction.editReply("I'm missing permissions in the ticket category, please contact an admin.");
		return null;
	}

	return { category, botMember };
}

/** The roles of the moderators and the admins, the ones that exist in the server */
async function FindStaffRoleIds(guild: Guild): Promise<string[]> {
	const modRoleId = await GetServerConfig(guild.id, "modRoleId");
	const adminRoleId = await GetServerConfig(guild.id, "adminRoleId");

	return [modRoleId, adminRoleId].filter((id): id is string => !!id && guild.roles.cache.has(id));
}

/** Only the owner, the staff and the bot can see the ticket */
function BuildTicketOverwrites(guild: Guild, ownerId: string, staffRoleIds: string[], botMemberId: string) {
	return [
		{ id: guild.roles.everyone.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
		{ id: ownerId, type: OverwriteType.Member, allow: TICKET_PERMISSIONS },
		...staffRoleIds.map((id) => ({
			id,
			type: OverwriteType.Role,
			allow: [...TICKET_PERMISSIONS, PermissionFlagsBits.ManageMessages],
		})),
		{ id: botMemberId, type: OverwriteType.Member, allow: [...TICKET_PERMISSIONS, PermissionFlagsBits.ManageChannels] },
	];
}

/** The first message of a ticket: explains what to do, pings the owner and the staff, and has the close and claim buttons */
async function SendWelcomeMessage(channel: TextChannel, ownerId: string) {
	const embed = new EmbedBuilder()
		.setTitle("🎫 Ticket")
		.setColor(Colors.Blurple)
		.setDescription(
			`Hi <@${ownerId}>! Describe what you need help with and a staff member will answer as soon as they can.\n\n` +
				`Moderators can't help with verification issues, administrators will take those.\n\n` +
				`-# When the ticket is closed a copy of the messages is saved for the staff.`,
		);

	await channel
		.send({
			content: `<@${ownerId}>${TICKET_PING_ROLE_ID ? ` <@&${TICKET_PING_ROLE_ID}>` : ""}`,
			embeds: [embed],
			components: BuildTicketRows(false),
			// only the owner and the staff role, nobody else that ends up in the text
			allowedMentions: { users: [ownerId], roles: TICKET_PING_ROLE_ID ? [TICKET_PING_ROLE_ID] : [] },
		})
		.catch((error) => console.error("Could not send the welcome message in a ticket:", SafeError(error)));
}

export async function CreateTicket(interaction: ButtonInteraction): Promise<void> {
	const guild = interaction.guild;
	if (!guild) return;

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const setup = await FindTicketCategory(interaction, guild);
	if (!setup) return;
	const { category, botMember } = setup;

	const user = interaction.user;

	try {
		if (guild.channels.cache.filter((channel) => channel.parentId === category.id).size >= MAX_CHANNELS_IN_CATEGORY) {
			await interaction.editReply("There are too many tickets open right now, please contact an admin.");
			return;
		}

		const staffRoleIds = await FindStaffRoleIds(guild);
		const displayName = (interaction.member as GuildMember | null)?.displayName ?? user.username;

		const channel = await guild.channels.create({
			name: `ticket-${Slug(displayName)}`,
			type: ChannelType.GuildText,
			parent: category.id,
			topic: `ticket:${user.id} | ${displayName.slice(0, 100)}`,
			permissionOverwrites: BuildTicketOverwrites(guild, user.id, staffRoleIds, botMember.id),
			reason: `Ticket opened by ${user.username}`,
		});

		await SendWelcomeMessage(channel, user.id);

		await interaction.editReply(`Your ticket has been created: <#${channel.id}>`);
		await SendLog(interaction.client, guild.id, `<@${user.id}> opened a ticket: <#${channel.id}>`);
	} catch (error) {
		console.error("Could not create a ticket:", SafeError(error));
		await interaction.editReply("Something went wrong while making your ticket, please contact a moderator.").catch(() => null);
	}
}

/**
 * The question before a ticket is closed
 */
export async function CloseQuestion(guildId: string): Promise<string> {
	const logChannelId = await GetServerConfig(guildId, "logChannel");

	return (
		"Are you sure you want to close this ticket? Nobody can write in it anymore, the staff can delete it afterwards." +
		(logChannelId
			? "\nA copy of the messages is saved for the staff."
			: "\nThere is no log channel set, so no copy of the messages is saved.")
	);
}

export function CloseConfirmRow(): ActionRowBuilder<ButtonBuilder> {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId(`${TICKET_BUTTON_ID}:confirm`).setLabel("Close ticket").setStyle(ButtonStyle.Danger),
		new ButtonBuilder().setCustomId(`${TICKET_BUTTON_ID}:cancel`).setLabel("Cancel").setStyle(ButtonStyle.Secondary),
	);
}

// the messages of a ticket as text, oldest first
async function BuildTranscript(channel: TextChannel, ownerId: string | null, by: User, label: string): Promise<string> {
	const messages: Message[] = [];
	let before: string | undefined;
	let reachedStart = false;

	for (let page = 0; page < MAX_TRANSCRIPT_PAGES; page++) {
		const fetched = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
		messages.push(...fetched.values());

		if (fetched.size < 100) {
			reachedStart = true;
			break;
		}
		before = fetched.last()?.id;
	}

	messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

	const time = (timestamp: number) => new Date(timestamp).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" });

	const lines = [
		`Ticket: ${channel.name}`,
		`Owner: ${ownerId}`,
		`${label}: ${by.username} (${by.id}) at ${time(Date.now())}`,
		...(reachedStart ? [] : [`The ${messages.length} newest messages are in here, older ones are left out.`]),
		"",
	];

	for (const message of messages) {
		lines.push(`[${time(message.createdTimestamp)}] ${message.author.username} (${message.author.id}): ${message.content}`);

		for (const embed of message.embeds) {
			if (embed.title || embed.description) lines.push(`  [embed] ${embed.title ?? ""} ${embed.description ?? ""}`.trimEnd());
		}
		for (const attachment of message.attachments.values()) {
			lines.push(`  [attachment] ${attachment.name}: ${attachment.url}`);
		}
	}

	return lines.join("\n");
}

export const TICKET_RATING_ID = "ticketrate";

function BuildRatingRow(guildId: string, claimerId: string | null): ActionRowBuilder<ButtonBuilder> {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		[1, 2, 3, 4, 5].map((stars) =>
			new ButtonBuilder()
				.setCustomId(`${TICKET_RATING_ID}:${guildId}:${stars}:${claimerId ?? "0"}`)
				.setLabel(`${stars}`)
				.setEmoji("⭐")
				.setStyle(ButtonStyle.Secondary),
		),
	);
}

/**
 * The messages of a ticket as a text file
 * @param label What the person did with it, "Closed by" or "Requested by"
 */
export async function BuildTranscriptFile(channel: TextChannel, by: User, label: string): Promise<AttachmentBuilder> {
	const transcript = await BuildTranscript(channel, GetTicketOwner(channel), by, label);

	return new AttachmentBuilder(Buffer.from(transcript, "utf-8"), { name: `${channel.name}.txt` });
}

/**
 * Takes a ticket for a staff member or lets go of it, and updates the buttons in the ticket
 * @param panel The message with the close and claim buttons, it is looked for if it isn't given
 * @returns null if it worked, otherwise why it didn't
 */
export async function ChangeClaim(channel: TextChannel, member: GuildMember, claiming: boolean, panel?: Message | null): Promise<string | null> {
	if (!(await IsStaff(member))) return "Only the staff can do that.";

	const claimer = GetTicketClaimer(channel);
	if (claiming && claimer === member.id) return "You are already handling this ticket.";
	if (claiming && claimer) return `<@${claimer}> is already handling this ticket.`;
	if (!claiming && !claimer) return "Nobody is handling this ticket.";
	if (!claiming && claimer !== member.id) return `<@${claimer}> is handling this ticket, only they can let go of it.`;

	try {
		await SetTicketClaimer(channel, claiming ? member.id : null);
	} catch (error) {
		return `I couldn't change that: ${ExplainError(error)}`;
	}

	// the buttons say Claim or Unclaim, and the first message shows who is handling it
	const message = panel ?? (await FindTicketPanel(channel));
	const embed = message?.embeds[0];
	await message
		?.edit({
			embeds: embed ? [EmbedBuilder.from(embed).setFooter(claiming ? { text: `Claimed by ${member.displayName}` } : null)] : undefined,
			components: BuildTicketRows(claiming),
		})
		.catch(() => null);

	await channel
		.send({
			content: claiming ? `✋ <@${member.id}> will help with this ticket.` : `<@${member.id}> is no longer handling this ticket.`,
			allowedMentions: { parse: [] },
		})
		.catch(() => null);

	return null;
}

/**
 * The first message of a ticket, the one the bot sent with the close and claim buttons
 */
async function FindTicketPanel(channel: TextChannel): Promise<Message | null> {
	const first = (await channel.messages.fetch({ after: "0", limit: 1 }).catch(() => null))?.first();

	return first && first.author.id === channel.client.user.id && first.components.length > 0 ? first : null;
}

/**
 * Saves a copy of the messages in the log channel and deletes the ticket
 * The ticket is only deleted if the copy was saved, or if there is no log channel
 * @returns Why it couldn't be closed, null if it was
 */
export async function CloseTicket(channel: TextChannel, closedBy: User, reason?: string): Promise<string | null> {
	try {
		const ownerId = GetTicketOwner(channel);
		const claimerId = GetTicketClaimer(channel);
		const logChannelId = await GetServerConfig(channel.guild.id, "logChannel");

		if (logChannelId) {
			const file = await BuildTranscriptFile(channel, closedBy, "Closed by");

			const saved = await SendToChannel(
				channel.client,
				logChannelId,
				`Ticket **${channel.name}** of <@${ownerId}> was closed by <@${closedBy.id}>.`,
				[file],
			);
			if (!saved) return "I couldn't save a copy of the messages in the log channel, so the ticket is still open.";
		}

		for (const overwrite of channel.permissionOverwrites.cache.values()) {
			if (overwrite.type === OverwriteType.Member && overwrite.id !== channel.client.user.id) {
				await channel.permissionOverwrites.edit(overwrite.id, { SendMessages: false, AddReactions: false });
			}
		}

		await channel.send({
			embeds: [
				new EmbedBuilder()
					.setColor(Colors.Red)
					.setTitle("Ticket closed")
					.setDescription(`Closed by <@${closedBy.id}>. Nobody can write here anymore, the staff can delete the channel.`),
			],
			components: BuildClosedRows(),
			allowedMentions: { parse: [] },
		});

		// they know if they closed it themselves, unless they can rate the help
		const canRate = !!logChannelId && !!ownerId;
		if (ownerId && (ownerId !== closedBy.id || canRate)) {
			const owner = await channel.client.users.fetch(ownerId).catch(() => null);
			const why = reason ?? (ownerId === closedBy.id ? "You closed it." : `It was closed by ${closedBy.username}. If you still need help you can open a new one.`);

			await owner
				?.send({
					content: `## Your ticket in ${channel.guild.name} has been closed\n${why}${canRate ? "\n\nHow was the help? The staff can see who rated.\nYou can also send feedback in this DM to send it to staff." : ""}`,
					components: canRate ? [BuildRatingRow(channel.guild.id, claimerId)] : [],
				})
				.catch(() => null);
		}

		try {
			await channel.setName(channel.name.replace(/^ticket-/, "closed-"), `Ticket closed by ${closedBy.username}`);
		} catch (error) {
			return `The ticket is closed, but I couldn't rename it: ${ExplainError(error)}`;
		}

		return null;
	} catch (error) {
		console.error("Could not close the ticket:", SafeError(error));
		return `Could not close the ticket: ${ExplainError(error)}`;
	}
}

/**
 * Opens a closed ticket again, the owner and everyone that was added can write in it
 * @returns null if it worked, otherwise why it didn't
 */
export async function OpenTicket(channel: TextChannel, openedBy: User, reason?: string): Promise<string | null> {
	if (!IsTicketClosed(channel)) return "This ticket is already open.";

	try {
		// the people can write again, reactions go back to what the channel says (what closing took away)
		for (const overwrite of channel.permissionOverwrites.cache.values()) {
			if (overwrite.type === OverwriteType.Member && overwrite.id !== channel.client.user.id) {
				await channel.permissionOverwrites.edit(overwrite.id, { SendMessages: true, AddReactions: null });
			}
		}

		await channel.send({
			embeds: [
				new EmbedBuilder()
					.setColor(Colors.Green)
					.setTitle("Ticket opened")
					.setDescription(`Opened by <@${openedBy.id}>. You can write here again.${reason ? `\nReason: ${reason}` : ""}`),
			],
			allowedMentions: { parse: [] },
		});

		// the log is only for the staff, it doesn't stop the ticket from opening
		await SendLog(channel.client, channel.guild.id, `Ticket **${channel.name}** of <@${GetTicketOwner(channel)}> was opened by <@${openedBy.id}>.${reason ? ` Reason: ${reason}` : ""}`);

		try {
			await channel.setName(channel.name.replace(/^closed-/, "ticket-"), `Ticket opened by ${openedBy.username}`);
		} catch (error) {
			return `The ticket is opened, but I couldn't rename it: ${ExplainError(error)}`;
		}

		return null;
	} catch (error) {
		console.error("Could not open the ticket:", SafeError(error));
		return `Could not open the ticket: ${ExplainError(error)}`;
	}
}
