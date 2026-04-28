import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder } from 'discord.js';

const command = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Get the current amount of members per region'),

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        if (!interaction.guild) return;

        await interaction.deferReply({ ephemeral: false });

        await interaction.guild.members.fetch();

        const rolesToTrack = [
            { name: '✂️ Borås', id: '1497160597220098148' },
            { name: '🐟 Göteborg', id: '1497160590647623690' },
            { name: '🍓 Halmstad', id: '1497142973668917248' },
            { name: '🏰 Helsingborg', id: '1497142972477734962' },
            { name: '🌊 Jönköping', id: '1497142974889332836' },
            { name: '🌹 Kungsbacka', id: '1497142971643072545' },
            { name: '🐯 Linköping', id: '1497142969726271538' },
            { name: '🎓 Lund', id: '1497149407169089536' },
            { name: '🍺 Malmö', id: '1497142975552290888' },
            { name: '🗝️ Nyköping', id: '1497140788864225360' },
            { name: '🛒 Stockholm Norra', id: '1497160592056647750' },
            { name: '👑 Stockholm Södra', id: '1497142976835747840' },
            { name: '🌉 Trollhättan', id: '1497160595823263804' },
            { name: '🌳 Växjö', id: '1497160595085066340' },
            { name: '🦅 Örebro', id: '1497160592866283631' },
        ];

        let description = "";

        // 2. Loop through and build the list
        for (const roleData of rolesToTrack) {
            const role = interaction.guild.roles.cache.get(roleData.id);
            const count = role ? role.members.size : 0;
            description += `**${roleData.name}:** ${count}\n`;
        }

        const embed = new EmbedBuilder()
            .setTitle(`Total Members: ${interaction.guild.members.cache.filter(m => !m.user.bot).size}`)
            .setDescription(description)
            .setColor(0x2b2d31)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};

export default command;