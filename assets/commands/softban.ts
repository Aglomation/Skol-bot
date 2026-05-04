import { SlashCommandBuilder, PermissionsBitField, ChatInputCommandInteraction, Client, GuildMember, PermissionFlagsBits, TextChannel } from 'discord.js';
import { getValue, updateProfileValue } from '../../utils/profileManager.js';
import { stringToDate } from '../../utils/stringConvert.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('softban')
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
        )
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration of the ban (s, m, h, d, mo, y, inf)')
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
        const reason = interaction.options.getString('reason', true);
        const date = stringToDate(interaction.options.getString('duration') || '');

        if (getValue(user.id, "banned")) {
            await interaction.editReply("User is already on the ban list.");
            return;
        }

        if (!date){
            await interaction.editReply("Invalid duration format.");
            return;
        }

        try {
            updateProfileValue(user.id, "banned", true);
            updateProfileValue(user.id, "banreason", reason);
            updateProfileValue(user.id, "banduration", String(Date.now() + date));

            await user.send(
                `## You have been banned from ${interaction.guild?.name}\n` +
                `For: ${reason}\n`+
                `Duration: ${Number.isFinite(date) ? `<t:${Math.floor(date / 1000)}>` : 'Indefinite'}\n` +
                `Expires: ${Number.isFinite(date) ? `<t:${Math.floor(date / 1000)}:R>` : 'Indefinite'}\n` +
                `Invite: https://discord.gg/dUYHv8Dv94`
            ).catch(() => {});

            // Kicks instead of banning to avoid IP-ban
            if (member) await member.kick(reason);

            await interaction.editReply(`**${user.tag}** has been banned.`);

            const logChannel = client.channels.cache.get('1499149296203993169') as TextChannel | undefined;
            if (logChannel) {
                await logChannel.send(`${interaction.user.tag} has softbanned <@${user.id}> for the reason: ${reason}`);
            }
        } catch (err) {
            console.error(err);
            await interaction.editReply("I can't kick that user. They might have a higher role than me.");
        }
    },
};


export default command;