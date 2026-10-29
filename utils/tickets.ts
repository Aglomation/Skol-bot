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
import { GetServerConfig } from "./configManager.js";
import { ExplainError } from "./errorText.js";
import { SendLog, SendToChannel } from "./logChannel.js";


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

/**
 * Parses the full channel topic into structured data.
 */
export function ParseTicketTopic(topic: string | null | undefined): TicketTopicData {
    if (!topic) {
        return { ownerId: null, displayName: null, claimerId: null };
    }

    const parts = topic.split("|").map((p) => p.trim());

    let ownerId: string | null = null;
    let displayName: string | null = null;
    let claimerId: string | null = null;

    for (const part of parts) {
        if (part.startsWith("ticket:")) {
            ownerId = part.replace("ticket:", "").trim();
        } else if (part.startsWith("displayName:")) {
            displayName = part.replace("displayName:", "").trim();
        } else if (part.startsWith("claimed:")) {
            claimerId = part.replace("claimed:", "").trim();
        }
    }

    return { ownerId, displayName, claimerId };
}

/**
 * Rebuilds and sets the channel topic from structured data parts.
 */
async function SaveTicketTopic(channel: TextChannel, data: TicketTopicData): Promise<void> {
    const parts: string[] = [];

    if (data.ownerId) {
        parts.push(`ticket:${data.ownerId}`);
    }
    if (data.displayName) {
        parts.push(`displayName:${data.displayName}`);
    }
    if (data.claimerId) {
        parts.push(`claimed:${data.claimerId}`);
    }

    const newTopic = parts.join(" | ");

    if (newTopic !== channel.topic) {
        await channel.setTopic(newTopic);
    }
}

/**
 * Who opened the ticket
 * @returns the user id of the owner if it is a ticket
 * @returns null if it isn't a ticket
 */
export function GetTicketOwner(channel: GuildBasedChannel): string | null {
    if (channel.type !== ChannelType.GuildText) return null;
    return ParseTicketTopic(channel.topic).ownerId;
}

/**
 * A ticket is a text channel in the ticket category that has an owner in its topic
 * @returns true if it is a ticket channel
 */
export function IsTicketChannel(channel: GuildBasedChannel, categoryId: string): channel is TextChannel {
    return channel.type === ChannelType.GuildText && channel.parentId === categoryId && GetTicketOwner(channel) !== null;
}

/**
 * Gets the staff member who claimed the ticket, or null if it isn't claimed
 * @returns the user id of the claimer if it is a ticket
 * @returns null if it isn't a ticket or if it isn't claimed
 */
export function GetTicketClaimer(channel: TextChannel): string | null {
    return ParseTicketTopic(channel.topic).claimerId;
}

/**
 * Sets or clears the staff member who claimed the ticket
 */
export async function SetTicketClaimer(channel: TextChannel, userId: string | null): Promise<void> {
    const data = ParseTicketTopic(channel.topic);
    data.claimerId = userId;
    await SaveTicketTopic(channel, data);
}

/**
 * Checks if the ticket is closed by checking if the owner is blocked from sending messages.
 */
export function IsTicketClosed(channel: TextChannel): boolean {
    const ownerId = GetTicketOwner(channel);
    if (!ownerId) return false;

    const overwrite = channel.permissionOverwrites.cache.get(ownerId);
    // If the owner has an explicit deny for SendMessages, the ticket is closed
    return overwrite?.deny.has(PermissionFlagsBits.SendMessages) ?? false;
}

export function BuildClosedRows(): ActionRowBuilder<ButtonBuilder>[] {
	return [
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setCustomId(`${TICKET_BUTTON_ID}:delete`).setLabel("Delete ticket").setEmoji("🗑️").setStyle(ButtonStyle.Danger),
			new ButtonBuilder().setCustomId(`${TICKET_BUTTON_ID}:open`).setLabel("Open ticket").setEmoji("🔓").setStyle(ButtonStyle.Success)
		)
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
 * Staff are the admins and the people with the mod or admin role of the server
 */
export async function IsStaff(member: GuildMember): Promise<boolean> {
	if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

	const modRoleId = await GetServerConfig(member.guild.id, "modRoleId");
	const adminRoleId = await GetServerConfig(member.guild.id, "adminRoleId");

	return [modRoleId, adminRoleId].some((id) => !!id && member.roles.cache.has(id));
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

/**
 * Makes a ticket for the person that pressed the button, a private text channel in the ticket category
 * Only they and the staff can see it, and nobody gets in by being mentioned there
 */
export async function CreateTicket(interaction: ButtonInteraction): Promise<void> {
	const guild = interaction.guild;
	if (!guild) return;

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const categoryId = await GetServerConfig(guild.id, "ticketCategory");
	const category = categoryId ? guild.channels.cache.get(categoryId) : undefined;
	if (!category || category.type !== ChannelType.GuildCategory) {
		await interaction.editReply("Tickets aren't set up in this server, please contact a moderator.");
		return;
	}

	const me = guild.members.me;
	const needed = [
		PermissionFlagsBits.ViewChannel,
		PermissionFlagsBits.SendMessages,
		PermissionFlagsBits.ManageChannels,
		PermissionFlagsBits.ManageRoles,
	];
	if (!me || !category.permissionsFor(me).has(needed)) {
		await interaction.editReply("I'm missing permissions in the ticket category, please contact an admin.");
		return;
	}

	const user = interaction.user;

	try {
		if (guild.channels.cache.filter((channel) => channel.parentId === category.id).size >= MAX_CHANNELS_IN_CATEGORY) {
			await interaction.editReply("There are too many tickets open right now, please contact an admin.");
			return;
		}

		const modRoleId = await GetServerConfig(guild.id, "modRoleId");
		const adminRoleId = await GetServerConfig(guild.id, "adminRoleId");

		const staffRoleIds = [modRoleId, adminRoleId].filter(
			(id): id is string => !!id && guild.roles.cache.has(id),
		);

		const displayName = (interaction.member as GuildMember | null)?.displayName ?? user.username;

		const channel = await guild.channels.create({
			name: `ticket-${Slug(displayName)}`,
			type: ChannelType.GuildText,
			parent: category.id,
			topic: `ticket:${user.id} | ${displayName.slice(0, 100)}`,
			permissionOverwrites: [
				{ id: guild.roles.everyone.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
				{ id: user.id, type: OverwriteType.Member, allow: TICKET_PERMISSIONS },
				...staffRoleIds.map((id) => ({
					id,
					type: OverwriteType.Role,
					allow: [...TICKET_PERMISSIONS, PermissionFlagsBits.ManageMessages],
				})),
				{ id: me.id, type: OverwriteType.Member, allow: [...TICKET_PERMISSIONS, PermissionFlagsBits.ManageChannels] },
			],
			reason: `Ticket opened by ${user.username}`,
		});

		// the staff get a ping, one role is enough
		const pingRoleId = "1560617409998757992";
		// const pingRoleId = [adminRoleId, modRoleId].find((id) => !!id && staffRoleIds.includes(id));

		const embed = new EmbedBuilder()
			.setTitle("🎫 Ticket")
			.setColor(Colors.Blurple)
			.setDescription(
				`Hi <@${user.id}>! Describe what you need help with and a staff member will answer as soon as they can.\n\n` +
				`Moderators can't help with verification issues, administrators will take those.\n\n` +
				`-# When the ticket is closed a copy of the messages is saved for the staff.`,
			);

		await channel
			.send({
				content: `<@${user.id}>${pingRoleId ? ` <@&${pingRoleId}>` : ""}`,
				embeds: [embed],
				components: BuildTicketRows(false),
				// only the owner and the staff role, nobody else that ends up in the text
				allowedMentions: { users: [user.id], roles: pingRoleId ? [pingRoleId] : [] },
			})
			.catch((error) => console.error("Could not send the welcome message in a ticket:", error));

		await interaction.editReply(`Your ticket has been created: <#${channel.id}>`);
		await SendLog(interaction.client, guild.id, `<@${user.id}> opened a ticket: <#${channel.id}>`);
	} catch (error) {
		console.error("Could not create a ticket:", error);
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
async function BuildTranscript(channel: TextChannel, ownerId: string | null, closedBy: User): Promise<string> {
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
		`Closed by: ${closedBy.username} (${closedBy.id}) at ${time(Date.now())}`,
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
			const transcript = await BuildTranscript(channel, ownerId, closedBy);
			const file = new AttachmentBuilder(Buffer.from(transcript, "utf-8"), { name: `${channel.name}.txt` });

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
					content: `## Your ticket in ${channel.guild.name} has been closed\n${why}${canRate ? "\n\nHow was the help? The staff can see who rated." : ""}`,
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
		console.error("Could not close the ticket:", error);
		return `Could not close the ticket: ${ExplainError(error)}`;
	}
}

export async function OpenTicket(channel: TextChannel, openedBy: User, reason?: string): Promise<string | null> {
	if (!IsTicketClosed(channel)) return "This ticket is already open.";

	try {
		const ownerId = GetTicketOwner(channel);
		const logChannelId = await GetServerConfig(channel.guild.id, "logChannel");

		if (logChannelId) {
			const saved = await SendLog(
				channel.client,
				channel.guild.id,
				`Ticket **${channel.name}** of <@${ownerId}> was opened by <@${openedBy.id}>.${reason ? ` Reason: ${reason}` : ""}`,
			);
			if (!saved) return "I couldn't save a copy of the messages in the log channel, so the ticket is still open.";
		}

		for (const overwrite of channel.permissionOverwrites.cache.values()) {
			if (overwrite.type === OverwriteType.Member && overwrite.id !== channel.client.user.id) {
				await channel.permissionOverwrites.edit(overwrite.id, { SendMessages: true, AddReactions: true });
			}
		}

		await channel.send({
			embeds: [
				new EmbedBuilder()
					.setColor(Colors.Green)
					.setTitle("Ticket opened")
					.setDescription(`Opened by <@${openedBy.id}>. You can write here again.`),
			],
			allowedMentions: { parse: [] },
		});

		try {
			await channel.setName(channel.name.replace(/^closed-/, "opened-"), `Ticket opened by ${openedBy.username}`);
		} catch (error) {
			return `The ticket is opened, but I couldn't rename it: ${ExplainError(error)}`;
		}

		return null;
	} catch (error) {
		console.error("Could not open the ticket:", error);
		await SendLog(channel.client, channel.guild.id, `Failed to open ticket **${channel.name}** by <@${openedBy.id}>: ${ExplainError(error)}`);
		return `Could not open the ticket: ${ExplainError(error)}`;
	}
}