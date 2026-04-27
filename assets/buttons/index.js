
module.exports = {
  data: {
    name: 'resync',
  },
  async execute(interaction,client) {
    interaction.reply({ content:'pong', ephemeral: true });
  }
};