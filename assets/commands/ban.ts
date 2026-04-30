import { SlashCommandBuilder, PermissionsBitField, ChatInputCommandInteraction, Client, GuildMember, PermissionFlagsBits, TextChannel } from 'discord.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bans a user from the server (Softban)')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to softban')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the ban')
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        await interaction.deferReply({ ephemeral: false });

        // Ensure interaction.member is treated as a GuildMember to access permissions
        const executor = interaction.member as GuildMember;

        if (!executor.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            await interaction.editReply("You don't have permission to use this.");
            return;
        }

        const user = interaction.options.getUser('user', true);
        const member = interaction.options.getMember('user') as GuildMember | null;
        const reason = interaction.options.getString('reason', true)

        if (!member) {
            await interaction.editReply("User is not in this server.");
            return;
        }

        if (client.banList.has(user.id)) {
            await interaction.editReply("User is already on the ban list.");
            return;
        }

        try {
            client.banList.add(user.id);
            client.saveBanlist();
            if (member) await member.kick(reason);
            await interaction.editReply(`**${user.tag}** has been banned.`);

            ( client.channels.cache.get('1499149296203993169') as TextChannel ).send(`${interaction.user.tag} has banned ${user.tag} for the reason: ${reason}`)
        } catch (err) {
            console.error(err);
            await interaction.editReply("I can't kick that user. They might have a higher role than me.");
        }
    },
};

export default command;