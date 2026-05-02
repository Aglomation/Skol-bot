import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Checks the bot latency'),

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        await interaction.deferReply({ 
            ephemeral: false 
        });
        const sent = await interaction.fetchReply()

        const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
        const websocket = client.ws.ping;

        await interaction.editReply({
            content: `Pong!\nRoundtrip: \`${roundtrip}ms\`\nWebSocket: \`${websocket}ms\``
        });
    },
};

export default command;