import { existsSync, mkdirSync } from "node:fs";
import fs from "node:fs/promises"; // Swapped to async fs promises
import type { ChatInputCommandInteraction, Client } from "discord.js";
import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import { getRoleUserCount } from "../../utils/memberUtils.js";

const Roles = {
    åk26: "1497140069843079226",
    åk25: "1497140069843079225",
    åk24: "1497140069843079224",
    åk23: "1497140069843079223",
    åk22: "1498635283321852006",
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

const command: Command = {
    data: new SlashCommandBuilder()
        .setName("stats")
        .setDescription("Get the current amount of members per region")
        .addStringOption((option) =>
            option
                .setName("order")
                .setDescription("Order the leaderboard by specific year")
                .setRequired(true)
                .addChoices(
                    { name: "Nuvarande", value: "current" },
                    { name: "Total", value: "all" },
                    { name: "Åk 26", value: "åk26" },
                    { name: "Åk 25", value: "åk25" },
                    { name: "Åk 24", value: "åk24" },
                    { name: "Åk 23", value: "åk23" },
                    { name : "Åk 22", value: "åk22" },
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
            let activeCount = 0;

            // This looks horrible but technically better than checking all years when we only want one.
            if (order === "all") {
                activeCount += getRoleUserCount(interaction.guild, roleData.id, false, [Roles.verified, Roles.åk26]);
                activeCount += getRoleUserCount(interaction.guild, roleData.id, false, [Roles.verified, Roles.åk25]);
                activeCount += getRoleUserCount(interaction.guild, roleData.id, false, [Roles.verified, Roles.åk24]);
                activeCount += getRoleUserCount(interaction.guild, roleData.id, false, [Roles.verified, Roles.åk23]);
                activeCount += getRoleUserCount(interaction.guild, roleData.id, false, [Roles.verified, Roles.åk22]);
            } else if (order === "current") {
                // Current classes that go to lbs :3
                activeCount += getRoleUserCount(interaction.guild, roleData.id, false, [Roles.verified, Roles.åk26]);
                activeCount += getRoleUserCount(interaction.guild, roleData.id, false, [Roles.verified, Roles.åk25]);
                activeCount += getRoleUserCount(interaction.guild, roleData.id, false, [Roles.verified, Roles.åk24]);
            } else {
                // order is a specific year (åk26, åk25, etc.)
                const specificRole = Roles[order as keyof typeof Roles];
                if (specificRole) {
                    activeCount = getRoleUserCount(interaction.guild, roleData.id, false, [Roles.verified, specificRole]);
                }
            }
            
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