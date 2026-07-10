import fs from "node:fs/promises"; // Swapped to async fs promises
import { existsSync, mkdirSync } from "node:fs";
import type { ChatInputCommandInteraction, Client } from "discord.js";
import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import { getRoleUserCount } from "../../utils/memberUtils.js";

const Roles = {
    åk26: "1497140069843079226",
    åk25: "1497140069843079225",
    åk24: "1497140069843079224",
    åk23: "1497140069843079223",
    verified: "1498832228145168514",
};

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

const command = {
    data: new SlashCommandBuilder()
        .setName("stats")
        .setDescription("Get the current amount of members per region")
        .addStringOption((option) =>
            option
                .setName("order")
                .setDescription("Order the leaderboard by specific year")
                .setRequired(true)
                .addChoices(
                    { name: "Total", value: "all" },
                    { name: "Åk 26", value: "åk26" },
                    { name: "Åk 25", value: "åk25" },
                    { name: "Åk 24", value: "åk24" },
                    { name: "Åk 23", value: "åk23" },
                )
        ),

    async execute(interaction: ChatInputCommandInteraction, _client: Client) {
        if (!interaction.guild) return;
        
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const order = interaction.options.getString("order", true);
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
            // Get individual counts
            const counts: Record<string, number> = {
                åk26: getRoleUserCount(interaction.guild, roleData.id, false, [Roles.verified, Roles.åk26]),
                åk25: getRoleUserCount(interaction.guild, roleData.id, false, [Roles.verified, Roles.åk25]),
                åk24: getRoleUserCount(interaction.guild, roleData.id, false, [Roles.verified, Roles.åk24]),
                åk23: getRoleUserCount(interaction.guild, roleData.id, false, [Roles.verified, Roles.åk23]),
            };

			// Remember to remove åk23 before the next year :3
            counts.all = counts.åk26 + counts.åk25 + counts.åk24 + counts.åk23;

            // get the count based on the user's choice
            const activeCount = counts[order] || 0;
            const percentage = roleData.studentCount > 0 ? (activeCount / roleData.studentCount) * 100 : 0;

            totalMembersForFilter += activeCount;
            totalStudentsCapacity += roleData.studentCount;

            finalSchoolData.push({
                name: key,
                activeCount,
                studentCount: roleData.studentCount,
                percentage,
            });
        }

        finalSchoolData.sort((a, b) => {
            if (order === "all") {
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
				? `\`👥 (${schoolData.activeCount}/${schoolData.studentCount}) • ${Math.round(schoolData.percentage)}%\``
				: `\`👥(${schoolData.activeCount}) • 🏫(≈${Math.round(schoolData.studentCount/3)})\``,
                inline: false,
            });
        });


        const embed = new EmbedBuilder()
            .setTitle(`Deltagarstatistik per stad (${order === "all" ? "Total" : order})`)
            .setDescription(
				order==="all"
                ? `Servermedlemmar: **${totalMembersForFilter}** • Nationell total: **${totalStudentsCapacity}** • Deltagande: **${Math.round(overallParticipation)}%**`
                : `Servermedlemmar: **${totalMembersForFilter}** • Nationell total: **≈${Math.round(totalStudentsCapacity/3)}** • Deltagande: **≈${Math.round(overallParticipation*3)}%**`
            )
            .addFields(fields)
            .setColor(0x2b2d31)
            .setTimestamp()
            .setFooter({ text: "Data: Skolverket API 🥵" });

        await interaction.editReply({ embeds: [embed] });
    },
};

export default command;