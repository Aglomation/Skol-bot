import type { ChatInputCommandInteraction, Client, GuildMember, SlashCommandSubcommandBuilder, TextChannel } from "discord.js";
import {
    Colors,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    PermissionsBitField,
} from "discord.js";
import { GetServerConfig } from "../../../utils/configManager.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
		.setName('rulesmessage')
        .setDescription('Posts the server rules embed into the current channel.');

export default async function command(
	interaction: ChatInputCommandInteraction,
	client: Client,
) {
    if (!interaction.guild) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    // Check if the user has the "Ban Members" permission, which assumes you're a moderator or admin
    const executor = interaction.member as GuildMember;

    if (!executor.permissions.has(PermissionsBitField.Flags.BanMembers) && await GetServerConfig(interaction.guild.id, "isDevServer") === false) {
        await interaction.editReply("You don't have permission to use this.");
        return;
    }
    const rulesEmbed = new EmbedBuilder()
        .setAuthor({ name: 'Rules & Guidelines', iconURL: interaction.guild?.iconURL() || '' })
        .setDescription(
            `**By being a member of this server, you agree to follow these rules.**\n` +
            `We apply common sense; if you are intentionally being disruptive, "it wasn't explicitly in the rules" will not be an excuse.\n\n` +
            `**Note:** Penalties may be adjusted on a case-by-case basis at staff discretion.\n​`
        )
        .setColor(Colors.Red)
        .addFields(
            {
                name: '*1. CONDUCT & RESPECT*',
                value: 
                    `​\n**1 § Harassment & Bullying:**\n` +
                    `Zero tolerance for bullying, exclusion, or personal attacks. We do not tolerate racism, sexism, homophobia, transphobia, or any form of hate speech.\n` +
                    `*Penalty:* Instant Permanent Ban for hate speech/severe attacks. For other harassment: (1-3d) Mute -> Permanent Ban.\n\n` +
                    `**2 § Pronouns & Identity:**\n` +
                    `Respect people's pronouns. Intentionally misgendering someone after being corrected is considered harassment.\n` +
                    `*Penalty:* Verbal Correction -> Formal Warning -> 24h Mute. Continued non-compliance will result in a 31d ban.\n\n` +
                    `**3 § Private Information (Doxxing):**\n` +
                    `Never share someone else’s (or your own) personal data, addresses, or private social media handles without explicit consent. This includes sharing media (images/videos) of people without permission.\n` +
                    `*Penalty:* Instant non-appealable Permanent Ban.\n​`
            },
            {
                name: '*2. CONTENT & MEDIA*',
                value:
                    `​\n**1 § NSFW (18+):**\n` +
                    `All content (images, text, links) that is pornographic, violent, or otherwise inappropriate is strictly prohibited. This is a school-aligned community.\n` +
                    `*Penalty:* Immediate Permanent Ban for explicit pornography. Warning / Mute depending on the content.\n\n` +
                    `**2 § AI-Generated Material:**\n` +
                    `No "AI-slop" in Art channel.\n` +
                    `*Penalty:* Content removal -> Warning -> 1d Mute.\n\n` +
                    `**3 § Illegal Activities:**\n` +
                    `The distribution, advertisement, or encouragement of illegal acts, drugs, etc is strictly forbidden.\n` +
                    `*Penalty:* Instant Ban.\n​`
            },
            {
                name: '*3. CHAT & COMMUNICATION*',
                value:
                    `​\n**1 § Spam & Disruptions:**\n` +
                    `No mass-pings, excessive caps, or emoji/image spamming. Screaming or playing loud music/noises in voice channels is prohibited.\n` +
                    `*Penalty:* Verbal Warning -> Formal Warning -> Kick/Mute.\n\n` +
                    `**2 § Politics:**\n` +
                    `Please keep political and highly divisive real-world discussions out of public channels to maintain a welcoming atmosphere.\n` +
                    `*Penalty:* Verbal Reminder -> (1-7d) Mute.\n\n` +
                    `**3 § Correct Channels:**\n` +
                    `Respect the purpose of each channel. Keep off-topic talk in general chat.\n` +
                    `*Penalty:* Verbal Reminder -> (1-4h) Mute.\n\n` +
                    `**4 § Self-Promotion:**\n` +
                    `Advertising your own streams, projects, or other servers is only allowed in the self-promotion channel.\n` +
                    `*Penalty:* Verbal Reminder -> (1-3d) Mute.\n​`
            },
            {
                name: '*4. MEMBERSHIP*',
                value:
                    `​\n**1 § Profile Integrity:**\n` +
                    `Your username and profile picture must not be offensive or impersonate others.\n` +
                    `*Penalty:* Request to change -> Kick.\n`
            },
            {
                name: '*5. PRIVACY POLICY*',
                value:
                    `​\n**1 § Privacy Policy:**\n` +
                    `\`/privacy policy\` to review the privacy policy.\n` +
                    `The policy can also be found at https://gist.github.com/Aglomation/03bb1931386d59bc69fba53684e91953\n` +
                    `\n**2 § Data Management:**\n` +
                    `\`/privacy options\` to set your privacy preferences.\n` +
                    `\`/privacy mydata\` to request a copy of your data.\n` +
                    `\`/privacy deleteme\` to delete your data and revoke server access.\n`
            }
        )
        .setFooter({ 
            text: 'Please treat others with kindness and help us keep the vibes positive!\n' +
                    'If you have any questions, contact a moderator or administrator.\n' +
                    'If you see someone breaking the rules, please open a #🚩・report!\n' +
                    `These rules were last updated on ${new Date().getDate()}/${new Date().getMonth() + 1}/${new Date().getFullYear()}.` 
        });
        

    const channel = client.channels.cache.get(interaction.channel?.id as string) as TextChannel;
    if (!client?.user || !channel?.permissionsFor(client.user)?.has(PermissionFlagsBits.SendMessages)) return;

    await channel.send({ embeds: [rulesEmbed] });
    await channel.send("**Channels mentioned in the rules:**\n§2.2: <#1497140071391039520>\n§3.4: <#1497140071864864769>\nFooter: <#1499885683995840683>");

    await interaction.deleteReply();
};