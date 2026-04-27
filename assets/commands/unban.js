const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('unbans a user')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('User to unban')
            .setRequired(true)
    ),

  async execute(interaction, client) {

    await interaction.deferReply({ ephemeral: false });

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
        return interaction.editReply("You don't have permission to use this.");
    }

    const user = interaction.options.getUser('user');
    const guild = interaction.guild.id

    if (guild != "1497140069746741338") {
        return interaction.editReply("User is not in this server.");
    }

    client.banList.delete(user.id);
    client.saveBanlist();
    return interaction.editReply("User is unbanned.");
  },
};