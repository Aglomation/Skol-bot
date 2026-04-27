const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('bans a user')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('User to softban')
            .setRequired(true)
    ),


  async execute(interaction, client) {

    await interaction.deferReply({ ephemeral: false });

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        return interaction.editReply("You don't have permission to use this.");
    }

    const user = interaction.options.getUser('user');
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
        return interaction.editReply("User is not in this server.");
    }

    if (client.banList.has(user.id)) {
        return interaction.editReply("User is already banned.");
    }

    client.banList.add(user.id);
    client.saveBanlist();

    try {
        await member.kick(`banned by ${interaction.user.tag}`);
        await interaction.editReply(`${user.tag} has been banned.`);
    } catch (err) {
        console.error(err);
        await interaction.editReply("I can't kick that user.");
    }
  },
};