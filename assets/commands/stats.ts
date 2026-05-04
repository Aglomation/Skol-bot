import {
    type ChatInputCommandInteraction,
    type Client,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";
import fs from "fs";

type UnitsReponsePartial = {
    value: string; // Ex: "cirka 420" osv
    valueType: string; // "EXISTS"
    timePeriod:
    | "2025/26"
    | "2024/25"
    | "2023/24"
    | "2022/23"
    | "2021/22"
    | "2020/21"
    | "2019/20"
    | "2018/19"
    | "2017/18"
    | "2016/17"
    | "2015/16";
};

interface FinalSchoolData {
    name: string;
    count: number;
    studentCount: number;
    percentage: number;
}

function parseLeaderboardPosition(position: number): string {
    switch (position) {
        case 1:
            return "🥇";
        case 2:
            return "🥈";
        case 3:
            return "🥉";
        default:
            return position.toString();
    }
}

const command = {
    data: new SlashCommandBuilder()
        .setName("stats")
        .setDescription("Get the current amount of members per region"),

    async execute(interaction: ChatInputCommandInteraction, _client: Client) {
        if (!interaction.guild) return;

        await interaction.deferReply({ ephemeral: false });

        await interaction.guild.members.fetch();

        const fields: { name: string; value: string; inline?: boolean }[] = [];
        const finalSchoolData: FinalSchoolData[] = [];

        if (!fs.existsSync("./cache/schools.json")) {
            if (!fs.existsSync("./cache")) fs.mkdirSync("./cache");
            return {};
        }
        const data = fs.readFileSync("./cache/schools.json", 'utf-8');
        const schoolData = JSON.parse(data) as { [key: string]: { id: string; studentCount: number } };

        for (const [key, roleData] of Object.entries(schoolData)) {
            const role = interaction.guild.roles.cache.get(roleData.id);
            const count = role ? role.members.size : 0;
            finalSchoolData.push({
                name: key,
                count,
                studentCount: roleData.studentCount,
                percentage: roleData.studentCount > 0 ? (count / roleData.studentCount) * 100 : 0,
            });
        }
        
        finalSchoolData.sort((a, b) => b.percentage - a.percentage);
        // build a summary and detailed fields
        const totalStudents = finalSchoolData.reduce((s, f) => s + f.studentCount, 0);
        const totalMembers = interaction.guild.members.cache.filter((m) => !m.user.bot).size;
        const overallParticipation = totalStudents > 0 ? (totalMembers / totalStudents) * 100 : 0;

        let index = 0;
        for (const schoolData of finalSchoolData) {
            index++;
            fields.push({
                name: `${parseLeaderboardPosition(index)} ${schoolData.name}`,
                value: `\`👥(${schoolData.count}/${schoolData.studentCount}) • ${Math.round(schoolData.percentage)}%\``,
                inline: false,
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`Deltagarstatistik per stad`)
            .setDescription(`Servermedlemmar: **${totalMembers}** • Nationelltotal: **${totalStudents}** • Deltagande: **${Math.round(overallParticipation)}%**`)
            .addFields(fields)
            .setColor(0x2b2d31)
            .setTimestamp()
            .setFooter({ text: 'Data: Skolverket API 🥵' });

        await interaction.editReply({ embeds: [embed] });
    },
};

export default command;
