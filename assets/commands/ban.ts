import { SlashCommandBuilder, PermissionsBitField, ChatInputCommandInteraction, Client, GuildMember } from 'discord.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bans a user from the server (Softban)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to softban')
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
            
            await member.kick(`Banned by ${interaction.user.tag}`);
            await interaction.editReply(`**${user.tag}** has been softbanned and kicked.`);
        } catch (err) {
            console.error(err);
            await interaction.editReply("I can't kick that user. They might have a higher role than me.");
        }
    },
};

export default command;