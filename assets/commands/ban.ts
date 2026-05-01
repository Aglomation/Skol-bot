import { SlashCommandBuilder, PermissionsBitField, ChatInputCommandInteraction, Client, GuildMember, PermissionFlagsBits, TextChannel } from 'discord.js';
import { getValue, updateProfileValue } from '../../utils/profileManager.js';

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

        if (!member) {
            await interaction.editReply("User is not in this server.");
            return;
        }

        if (getValue(user.id, "banned")) {
            await interaction.editReply("User is already on the ban list.");
            return;
        }

        try {
            updateProfileValue(user.id, "banned", true);
            updateProfileValue(user.id, "banreason", reason);
            updateProfileValue(user.id, "banduration", date?.toISOString() || null);

            await user.send({
                embeds: [{
                    color: 0xFF0000,
                    title: `You have been banned from ${interaction.guild?.name}`,
                    fields: [
                        { name: 'Reason', value: reason, inline: false },
                        { name: 'Duration', value: date ? `<t:${Math.floor(date.getTime() / 1000)}>` : 'Indefinite', inline: false },
                        { name: 'Expires', value: date ? `<t:${Math.floor(date.getTime() / 1000)}:R>` : 'Indefinite', inline: false },
                        { name: 'Invite', value: 'https://discord.gg/dUYHv8Dv94', inline: false }
                    ]
                }]
            }).catch(() => {});

            // Kicks instead of banning to avoid IP-ban
            await member.kick(reason);

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

function stringToDate(input: string): Date | null {
    if (!input) return null;
    const cleaned = String(input).replace(/[()\s]/g, '');
    const re = /(\d+)(inf|y|mo|d|h|m|s)/g;
    const multipliers: Record<string, number> = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        mo: 30 * 24 * 60 * 60 * 1000,
        y: 365 * 24 * 60 * 60 * 1000,
        inf: 0,
    };

    let totalMs = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(cleaned)) !== null) {
        const value = parseInt(match[1], 10) || 0;
        const unit = match[2];
        if (!Number.isNaN(value) && multipliers[unit]) {
            totalMs += value * multipliers[unit];
        }
    }

    return totalMs > 0 ? new Date(Date.now() + totalMs) : null;
}

export default command;