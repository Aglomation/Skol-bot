const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Description'),

  async execute(interaction) {

    await interaction.deferReply({
      content: 'content',
      fetchReply: true,
      ephemeral: true,
    });

    await interaction.editReply(
      `Pong!`
    );
  },
};