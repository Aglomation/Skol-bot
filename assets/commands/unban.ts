import { SlashCommandBuilder, PermissionsBitField, ChatInputCommandInteraction, Client, GuildMember, PermissionFlagsBits } from 'discord.js';
import { updateProfileValue, getValue } from '../../utils/profileManager.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Removes a user from the softban list')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to unban')
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        await interaction.deferReply({ ephemeral: false });

        const executor = interaction.member as GuildMember;
        if (!executor.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            await interaction.editReply("You don't have permission to use this.");
            return;
        }

        const user = interaction.options.getUser('user', true);

        if (interaction.guildId !== "1497140069746741338") {
            await interaction.editReply("This command is restricted for this server.");
            return;
        }

        if (!getValue(user.id, "banned")) {
            await interaction.editReply("That user is not on the ban list.");
            return;
        }

        updateProfileValue(user.id, "banned", false);
        updateProfileValue(user.id, "banreason", null);
        updateProfileValue(user.id, "banduration", null);

        await interaction.editReply(`**${user.tag}** has been removed from the ban list.`);
    },
};

export default command;