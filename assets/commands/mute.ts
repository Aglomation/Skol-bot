import { SlashCommandBuilder, PermissionsBitField, ChatInputCommandInteraction, Client, GuildMember, PermissionFlagsBits, TextChannel } from 'discord.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Mutes a user (timeout)')
        .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to mute')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the mute')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration of the mute (s, m, h, d, mo, y, inf)')
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        await interaction.deferReply({ ephemeral: false });

        // Ensure interaction.member is treated as a GuildMember to access permissions
        const executor = interaction.member as GuildMember;

        if (!executor.permissions.has(PermissionsBitField.Flags.MuteMembers)) {
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

        if (!date){
            await interaction.editReply("Invalid duration format.");
            return;
        }
        
        try {
            await member.timeout(date, reason);

            await user.send(
                `## You have been muted from ${interaction.guild?.name}\n` +
                `For: ${reason}\n`+
                `Duration: ${date ? `<t:${Math.floor(new Date(String(date)).getTime() / 1000)}>` : 'Indefinite'}\n` +
                `Expires: ${date ? `<t:${Math.floor(new Date(String(date)).getTime() / 1000)}:R>` : 'Indefinite'}\n`
            ).catch(() => {});

            await interaction.editReply(`**${user.tag}** has been muted.`);

            const logChannel = client.channels.cache.get('1499149296203993169') as TextChannel | undefined;
            if (logChannel) {
                await logChannel.send(`${interaction.user.tag} has muted <@${user.id}> for the reason: ${reason}`);
            }
        } catch (err) {
            console.error(err);
            await interaction.editReply("I can't mute that user. They might have a higher role than me.");
        }
    },
};

function stringToDate(input: string): number | null {
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

    return totalMs > 0 ? totalMs : null;
}

export default command;