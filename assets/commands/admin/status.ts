import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { EmbedBuilder, MessageFlags, PermissionFlagsBits } from "discord.js";
import { eq, sql } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { userProfileTable } from "../../../db/schema.js";
import { GetFullServerConfig } from "../../../utils/configManager.js";
import { GetSessions, IsActive } from "../../../utils/lfg.js";
import { HasPermission } from "../../../utils/permissions.js";
import { GetTasks } from "../../../utils/taskStatus.js";
import { IsTicketChannel, IsTicketClosed } from "../../../utils/tickets.js";
import { SETTINGS } from "../config/settings.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand.setName("status").setDescription("Shows how the bot is doing");

const Time = (timestamp: number) => `<t:${Math.floor(timestamp / 1000)}:R>`;

async function GetProfileCounts(guildId: string): Promise<{ total: number; emails: number } | null> {
	try {
		const [row] = await db
			.select({ total: sql<number>`count(*)`, emails: sql<number>`count(${userProfileTable.email})` })
			.from(userProfileTable)
			.where(eq(userProfileTable.serverId, guildId));
		return { total: Number(row.total), emails: Number(row.emails) };
	} catch {
		return null;
	}
}

async function GetDatabasePing(): Promise<string> {
	const start = performance.now();
	try {
		await db.execute(sql`select 1`);
		return `${Math.round(performance.now() - start)} ms`;
	} catch {
		return "not reachable";
	}
}

export default async function command(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	if (!(await HasPermission(interaction, PermissionFlagsBits.Administrator))) return;

	const guild = interaction.guild;
	const client = interaction.client;

	const [config, profiles, databasePing, lfgSessions] = await Promise.all([
		GetFullServerConfig(guild.id, true),
		GetProfileCounts(guild.id),
		GetDatabasePing(),
		GetSessions(guild.id),
	]);

	const missing = SETTINGS.filter((setting) => !config?.[setting.key]);
	const categoryId = config?.ticketCategory;
	const openTickets = categoryId ? guild.channels.cache.filter((channel) => IsTicketChannel(channel, categoryId) && !IsTicketClosed(channel)).size : 0;

	const tasks = GetTasks().map(([name, status]) => {
		if (status.lastError && (!status.lastRun || (status.lastErrorAt ?? 0) > status.lastRun)) {
			return `⚠️ ${name}: failed ${Time(status.lastErrorAt ?? 0)}, ${status.lastError}`;
		}
		return status.lastRun ? `✅ ${name}: ${Time(status.lastRun)}` : `⏳ ${name}: not run yet`;
	});

	const runtime = process.versions.bun ? `Bun ${process.versions.bun}` : `Node ${process.versions.node}`;

	const embed = new EmbedBuilder()
		.setTitle("Bot status")
		.setColor(missing.length > 0 || databasePing === "not reachable" ? 0xe67e22 : 0x2ecc71)
		.addFields(
			{ name: "Online since", value: Time(Date.now() - process.uptime() * 1000), inline: true },
			{ name: "Discord", value: `${Math.round(client.ws.ping)} ms`, inline: true },
			{ name: "Database", value: databasePing, inline: true },
			{ name: "Memory", value: `${Math.round(process.memoryUsage().rss / 1048576)} MB`, inline: true },
			{ name: "Runtime", value: runtime, inline: true },
			{ name: "Servers", value: `${client.guilds.cache.size}`, inline: true },
			{
				name: "This server",
				value: [
					`Members: ${guild.memberCount}`,
					profiles ? `Profiles: ${profiles.total} (${profiles.emails} with an email)` : "Profiles: could not be counted",
					`Open tickets: ${openTickets}`,
					`Game sessions: ${lfgSessions.filter(IsActive).length}`,
				].join("\n"),
			},
			{
				name: `Settings (${SETTINGS.length - missing.length}/${SETTINGS.length})`,
				value: missing.length > 0 ? `Not set: ${missing.map((setting) => setting.label).join(", ")}` : "Everything is set",
			},
			{ name: "Background tasks", value: tasks.length > 0 ? tasks.join("\n").slice(0, 1000) : "None" },
		);

	await interaction.editReply({ embeds: [embed] });
}
