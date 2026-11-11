import fs from "node:fs/promises";
import type { ChatInputCommandInteraction, Guild } from "discord.js";
import { EmbedBuilder, InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import { FormatGrowth, GetSnapshots } from "../../features/memberHistory.js";
import { YEARS } from "../../features/verify/options.js";
import { GetServerConfig } from "../../utils/configManager.js";

const SCHOOLS_FILE = "./cache/schools.json"; // written by repeating/schools.ts
const EMBED_COLOR = 0x2b2d31;
// a school has about three classes of students (the three years), so one year is a third of it
const YEARS_AT_SCHOOL = 3;

// the year roles from the verify options (26, 25, 24, 23, 22), not the teacher one
const STUDENT_YEARS = YEARS.filter((year) => year.roleId && /^\d+$/.test(year.key));
// the ones that still go to the school
const CURRENT_YEARS = STUDENT_YEARS.filter((year) => !year.alumni);

type SchoolFile = Record<string, { id: string; studentCount: number }>;

/** The numbers of one city, ready to be shown */
type CityStats = {
	name: string;
	members: number;
	/** The students of the school (all years) */
	students: number;
	/** Members out of the students that are counted, in percent */
	percentage: number;
};

/**
 * What the leaderboard counts and how it is shown, picked with the order option:
 * "current" = the years still at school, with percentages. "all" = every year, only counts. "åk25" = that year alone (a third of the students)
 */
type OrderMode = {
	label: string;
	years: typeof STUDENT_YEARS;
	/** The percentages are what the cities are sorted by and what the title says is shown */
	byPercentage: boolean;
	/** Only a single year, so the number of students is a guess */
	singleYear: boolean;
};

function ResolveOrder(order: string): OrderMode {
	if (order === "all") return { label: "Total", years: STUDENT_YEARS, byPercentage: false, singleYear: false };
	if (order === "current") return { label: "Nuvarande", years: CURRENT_YEARS, byPercentage: true, singleYear: false };

	return { label: order, years: STUDENT_YEARS.filter((year) => `åk${year.key}` === order), byPercentage: false, singleYear: true };
}

/** 🥇🥈🥉 for the first three, then the number */
function MedalOrPosition(position: number): string {
	return ["🥇", "🥈", "🥉"][position - 1] ?? String(position);
}

/**
 * Counts the members that have the role and all of the extra roles
 */
function CountMembers(guild: Guild, roleId: string, extraRoleIds: string[]): number {
	const role = guild.roles.cache.get(roleId);
	if (!role) return 0;

	return role.members.filter((member) => extraRoleIds.every((id) => member.roles.cache.has(id))).size;
}

/** The members of every city that are verified and have one of the years, and what that is out of the students */
function CountCities(guild: Guild, schools: SchoolFile, verifiedRoleId: string, mode: OrderMode): CityStats[] {
	return Object.entries(schools).map(([name, school]) => {
		const members = mode.years.reduce(
			(total, year) => total + CountMembers(guild, school.id, [verifiedRoleId, year.roleId as string]),
			0,
		);
		const countedStudents = mode.singleYear ? school.studentCount / YEARS_AT_SCHOOL : school.studentCount;

		return { name, members, students: school.studentCount, percentage: countedStudents > 0 ? (members / countedStudents) * 100 : 0 };
	});
}

function FormatCityLine(city: CityStats, mode: OrderMode): string {
	const percentage = Math.round(city.percentage);
	if (mode.byPercentage) return `\`👥(${city.members}) • 🏫(${city.students}) • ${percentage}%\``;
	if (mode.singleYear) return `\`👥(${city.members}) • 🏫(≈${Math.round(city.students / YEARS_AT_SCHOOL)}) • ${percentage}%\``;

	return `\`👥 (${city.members})\``;
}

function FormatSummary(cities: CityStats[], mode: OrderMode): string {
	const members = cities.reduce((total, city) => total + city.members, 0);
	if (!mode.byPercentage && !mode.singleYear) return `Servermedlemmar: **${members}**`;

	const students = cities.reduce((total, city) => total + (mode.singleYear ? city.students / YEARS_AT_SCHOOL : city.students), 0);
	const participation = students > 0 ? (members / students) * 100 : 0;
	const studentsShown = mode.singleYear ? `≈${Math.round(students)}` : students;

	return `Servermedlemmar: **${members}** • Nationell total: **${studentsShown}** • Deltagande: **≈${Math.round(participation)}%**`;
}

/** How many verified members each city got over the last days */
async function ShowGrowth(interaction: ChatInputCommandInteraction, guild: Guild, days: number) {
	const snapshots = await GetSnapshots(guild.id, days);
	if (snapshots.length < 2) {
		await interaction.editReply("There isn't enough history yet, it saves the numbers once a day.");
		return;
	}

	const embed = new EmbedBuilder()
		.setTitle(`Verifierade medlemmar per stad, ${days} dagar`)
		.setDescription(`\`\`\`\n${FormatGrowth(snapshots).join("\n")}\n\`\`\``)
		.setFooter({ text: `${snapshots[0][0]} till ${snapshots[snapshots.length - 1][0]}` })
		.setColor(EMBED_COLOR);

	await interaction.editReply({ embeds: [embed] });
}

/** The cities ranked by how many members they have (or by what share of the students, for "current") */
async function ShowLeaderboard(interaction: ChatInputCommandInteraction, guild: Guild, order: string) {
	const verifiedRoleId = await GetServerConfig(guild.id, "verifiedRoleId");
	if (!verifiedRoleId) {
		await interaction.editReply("Verified role is not set up in the server configuration.");
		return;
	}

	const schools = await fs.readFile(SCHOOLS_FILE, "utf-8").then(
		(text) => JSON.parse(text) as SchoolFile,
		() => null,
	);
	if (!schools) {
		await interaction.editReply("No school data found in cache.");
		return;
	}

	// the counts come from the cache, so everyone has to be in it
	if (guild.members.cache.size < guild.memberCount) {
		await guild.members.fetch().catch((error) => console.error("Could not fetch the members for /citystats:", error));
	}

	const mode = ResolveOrder(order);
	const cities = CountCities(guild, schools, verifiedRoleId, mode).sort((a, b) =>
		mode.byPercentage ? b.percentage - a.percentage : b.members - a.members,
	);

	const embed = new EmbedBuilder()
		.setTitle(`Deltagarstatistik per stad (${mode.label}) ( ♻️ ${mode.byPercentage ? "%" : "Antal"} )`)
		.setDescription(FormatSummary(cities, mode))
		.addFields(cities.map((city, index) => ({ name: `${MedalOrPosition(index + 1)} ${city.name}`, value: FormatCityLine(city, mode), inline: false })))
		.setColor(EMBED_COLOR)
		.setTimestamp()
		.setFooter({ text: `Data: Skolverket API ${mode.singleYear ? "& Guessing " : ""}🥵` });

	await interaction.editReply({ embeds: [embed] });
}

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("citystats")
		.setDescription("Get the current amount of members per region")
		.setContexts(InteractionContextType.Guild)
		.addStringOption((option) =>
			option
				.setName("order")
				.setDescription("Order the leaderboard by specific year")
				.addChoices(
					{ name: "Nuvarande", value: "current" },
					{ name: "Total", value: "all" },
					{ name: "Åk 26", value: "åk26" },
					{ name: "Åk 25", value: "åk25" },
					{ name: "Åk 24", value: "åk24" },
					{ name: "Åk 23", value: "åk23" },
					{ name : "Åk 22", value: "åk22" },
				)
		)
		.addIntegerOption((option) =>
			option
				.setName("growth")
				.setDescription("Show how many verified members each city got over the last days instead")
				.addChoices(
					{ name: "7 days", value: 7 },
					{ name: "30 days", value: 30 },
					{ name: "90 days", value: 90 },
				)
		),

	async execute(interaction: ChatInputCommandInteraction) {
		const guild = interaction.guild;
		if (!guild) return;

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const growthDays = interaction.options.getInteger("growth");
		if (growthDays) {
			await ShowGrowth(interaction, guild, growthDays);
		} else {
			await ShowLeaderboard(interaction, guild, interaction.options.getString("order") ?? "current");
		}
	},
};

export default command;
