import { SlashCommandBuilder, PermissionsBitField, ChatInputCommandInteraction, Client, GuildMember, PermissionFlagsBits, TextChannel } from 'discord.js';
import { getValue, updateProfileValue } from '../../utils/profileManager.js';

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
        )
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration of the ban (s, m, h, d, mo, y)')
                .setRequired(false)
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

        if (!member) {
            await interaction.editReply("User is not in this server.");
            return;
        }

        if (getValue(user.id, "banned")) {
            await interaction.editReply("User is already on the ban list.");
            return;
        }

        try {
            updateProfileValue(user.id, "banned", true)
            updateProfileValue(user.id, "banreason", reason)
            updateProfileValue(user.id, "banduration", date?.toISOString() || null)

            await user.send(
                `You have been banned from the server for: ${reason}\n` +
                `Duration: ${date ? `<t:${Math.floor(date.getTime() / 1000)}>` : 'Indefinite'}\n` +
                `Expires: ${date ? `<t:${Math.floor(date.getTime() / 1000)}:R>` : 'Indefinite'}\n` +
                `Invite: https://discord.gg/dUYHv8Dv94`
            ).catch(() => {});

            if (member) await member.kick(reason);
            await interaction.editReply(`**${user.tag}** has been banned.`);

            ( client.channels.cache.get('1499149296203993169') as TextChannel ).send(`${interaction.user.tag} has banned ${user.tag} for the reason: ${reason}`)
        } catch (err) {
            console.error(err);
            await interaction.editReply("I can't kick that user. They might have a higher role than me.");
        }
    },
};

function stringToDate(input: string): Date | null {
    if (!input) return null;
    const cleaned = String(input).replace(/[()\s]/g, '');
    const re = /(\d+)(mo|y|d|h|m|s)/g;
    const multipliers: Record<string, number> = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        mo: 30 * 24 * 60 * 60 * 1000,
        y: 365 * 24 * 60 * 60 * 1000,
    };

    let totalMs = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(cleaned)) !== null) {
        const value = parseInt(match[1], 10);
        const unit = match[2];
        if (!Number.isNaN(value) && multipliers[unit]) {
            totalMs += value * multipliers[unit];
        }
    }

    return totalMs > 0 ? new Date(Date.now() + totalMs) : null;
}

export default command;