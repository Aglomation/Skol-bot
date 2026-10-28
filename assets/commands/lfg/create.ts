import type { ChatInputCommandInteraction, GuildMember, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags } from "discord.js";
import type { LfgSession } from "../../../utils/lfg.js";
import { AddSession, BuildEmbed, BuildRows, ParseWhen, REMIND_BEFORE_MS } from "../../../utils/lfg.js";
import { IsVerified } from "../../../utils/permissions.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("create")
		.setDescription("Post a game session people can sign up for")
		.addStringOption((option) =>
			option.setName("game").setDescription("What you want to play").setMaxLength(60).setRequired(true).setAutocomplete(true),
		)
		.addStringOption((option) =>
			option
				.setName("when")
				.setDescription("20:00, tomorrow 19:30, friday 21:00, in 2h, 2026-12-24 18:00 (default: now)")
				.setMaxLength(40),
		)
		.addIntegerOption((option) =>
			option.setName("players").setDescription("How many can join, you included (default: no limit)").setMinValue(2).setMaxValue(100),
		)
		.addStringOption((option) => option.setName("note").setDescription("Anything people should know").setMaxLength(200));

export default async function command(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) return;

	const member = interaction.member as GuildMember;
	const refuse = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

	if (!(await IsVerified(member))) {
		await refuse("Du måste vara verifierad för att använda det här kommandot.");
		return;
	}

	const now = Date.now();
	const startsAt = ParseWhen(interaction.options.getString("when") ?? "now", now);

	if (startsAt === null) {
		await refuse("I couldn't read that time. Try `20:00`, `tomorrow 19:30`, `friday 21:00`, `in 2h` or `2026-12-24 18:00`.");
		return;
	}
	if (startsAt < now - 60 * 1000) {
		await refuse("That time has already passed.");
		return;
	}

	const startsNow = startsAt - now < 5000;
	const session: LfgSession = {
		id: "",
		guildId: interaction.guild.id,
		channelId: interaction.channelId,
		hostId: member.id,
		game: interaction.options.getString("game", true).trim(),
		note: interaction.options.getString("note")?.trim() || null,
		startsAt: Math.max(startsAt, now),
		maxPlayers: interaction.options.getInteger("players"),
		going: [member.id],
		maybe: [],
		waitlist: [],
		status: startsNow ? "started" : "open",
		remindedAt: startsAt - now <= REMIND_BEFORE_MS ? now : null,
		startedAt: startsNow ? now : null,
		closedAt: null,
		createdAt: now,
	};

	await interaction.reply({
		embeds: [BuildEmbed(session)],
		components: BuildRows(session),
	});

	session.id = (await interaction.fetchReply()).id;
	await AddSession(session);
}
