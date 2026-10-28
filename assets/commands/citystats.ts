import { existsSync, mkdirSync } from "node:fs";
import fs from "node:fs/promises"; // Swapped to async fs promises
import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder, InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import { GetServerConfig } from "../../utils/configManager.js";
import { FormatGrowth, GetSnapshots } from "../../utils/memberHistory.js";
import { GetRoleUserCount } from "../../utils/memberUtils.js";
import { YEARS } from "../../utils/verifyOptions.js";

// the year roles from the verify options (26, 25, 24, 23, 22), not the teacher one
const STUDENT_YEARS = YEARS.filter((year) => year.roleId && /^\d+$/.test(year.key));
// the ones that still go to the school
const CURRENT_YEARS = STUDENT_YEARS.filter((year) => !year.alumni);

interface FinalSchoolData {
	name: string;
	activeCount: number;
	studentCount: number;
	percentage: number;
}

function parseLeaderboardPosition(position: number): string {
	switch (position) {
		case 1: return "🥇";
		case 2: return "🥈";
		case 3: return "🥉";
		default: return position.toString();
	}
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
		if (!interaction.guild) return;

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const growth = interaction.options.getInteger("growth");
		if (growth) {
			const snapshots = await GetSnapshots(interaction.guild.id, growth);
			if (snapshots.length < 2) {
				await interaction.editReply("There isn't enough history yet, it saves the numbers once a day.");
				return;
			}

			const embed = new EmbedBuilder()
				.setTitle(`Verifierade medlemmar per stad, ${growth} dagar`)
				.setDescription(`\`\`\`\n${FormatGrowth(snapshots).join("\n")}\n\`\`\``)
				.setFooter({ text: `${snapshots[0][0]} till ${snapshots[snapshots.length - 1][0]}` })
				.setColor(0x2b2d31);

			await interaction.editReply({ embeds: [embed] });
			return;
		}

		const order = interaction.options.getString("order") ?? "current";
		const verifiedRoleId = await GetServerConfig(interaction.guild.id, "verifiedRoleId");
		if (!verifiedRoleId) {
			await interaction.editReply("Verified role is not set up in the server configuration.");
			return;
		}

		// the counts come from the cache, so everyone has to be in it
		if (interaction.guild.members.cache.size < interaction.guild.memberCount) {
			await interaction.guild.members.fetch().catch((error) => console.error("Could not fetch the members for /stats:", error));
		}

		// which year roles are counted
		const years = order === "all"
			? STUDENT_YEARS
			: order === "current"
				? CURRENT_YEARS
				: STUDENT_YEARS.filter((year) => `åk${year.key}` === order);
		// only verified members, unless unverified is on
		const fields: { name: string; value: string; inline?: boolean }[] = [];
		const finalSchoolData: FinalSchoolData[] = [];

		if (!existsSync("./cache")) mkdirSync("./cache");

		if (!existsSync("./cache/schools.json")) {
			await interaction.editReply("No school data found in cache.");
			return;
		}

		// Async file reading
		const data = await fs.readFile("./cache/schools.json", "utf-8");
		const schoolData = JSON.parse(data) as Record<string, { id: string; studentCount: number }>;

		let totalMembersForFilter = 0;
		let totalStudentsCapacity = 0;

		for (const [key, roleData] of Object.entries(schoolData)) {
			// members with the city role and (the verified role and) the year role, added up for every year
			const activeCount = years.reduce(
				(total, year) => total + GetRoleUserCount(interaction.guild, roleData.id, false, [verifiedRoleId, year.roleId as string]),
				0,
			);

			// 3 classes of students divided by 3 is roughly one class
			const studentCount = (order === "all" || order === "current")
				? roleData.studentCount
				: roleData.studentCount / 3;

			const percentage = studentCount > 0 ? (activeCount / studentCount) * 100 : 0;

			totalMembersForFilter += activeCount;
			totalStudentsCapacity += studentCount;

			finalSchoolData.push({
				name: key,
				activeCount,
				studentCount: roleData.studentCount,
				percentage,
			});
		}

		finalSchoolData.sort((a, b) => {
			if (order === "current") {
				return b.percentage - a.percentage;
			}
			return b.activeCount - a.activeCount;
		});

		const overallParticipation = totalStudentsCapacity > 0
			? (totalMembersForFilter / totalStudentsCapacity) * 100
			: 0;

		// Build the embed fields
		finalSchoolData.forEach((schoolData, index) => {
			fields.push({
				name: `${parseLeaderboardPosition(index + 1)} ${schoolData.name}`,
				value: order==="all"
				? `\`👥 (${schoolData.activeCount})\``
				: order==="current"
				? `\`👥(${schoolData.activeCount}) • 🏫(${schoolData.studentCount}) • ${Math.round(schoolData.percentage)}%\``
				: `\`👥(${schoolData.activeCount}) • 🏫(≈${Math.round(schoolData.studentCount/3)}) • ${Math.round(schoolData.percentage)}%\``,
				inline: false,
			});
		});


		const embed = new EmbedBuilder()
			.setTitle(`Deltagarstatistik per stad (${order === "all" ? "Total" : order === "current" ? "Nuvarande" : order}) ( ♻️ ${order === "current" ? "%" : "Antal"} )`)
			.setDescription(
				order==="all"
				? `Servermedlemmar: **${totalMembersForFilter}**`
				: order==="current"
				? `Servermedlemmar: **${totalMembersForFilter}** • Nationell total: **${totalStudentsCapacity}** • Deltagande: **≈${Math.round(overallParticipation)}%**`
				: `Servermedlemmar: **${totalMembersForFilter}** • Nationell total: **≈${Math.round(totalStudentsCapacity/3)}** • Deltagande: **≈${Math.round(overallParticipation)}%**`
			)
			.addFields(fields)
			.setColor(0x2b2d31)
			.setTimestamp()
			.setFooter({ text: `Data: Skolverket API ${order!== "all" && order!== "current" ? "& Guessing " : ""}🥵` });

		await interaction.editReply({ embeds: [embed] });
	},
};

export default command;
