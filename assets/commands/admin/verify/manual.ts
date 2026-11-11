import type { ChatInputCommandInteraction, GuildMember, SlashCommandSubcommandBuilder, User } from "discord.js";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { IsEmail, IsTeacherEmail } from "../../../../features/emails.js";
import { CompleteVerification } from "../../../../features/verify/flow.js";
import { SendLog } from "../../../../utils/logChannel.js";
import { HasPermission } from "../../../../utils/permissions.js";
import { FindByValue, PROFILE_DUPLICATE, UpdateProfile } from "../../../../utils/profileManager.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
        .setName("manual")
        .setDescription("Manually verifies a user by setting their email and giving them the verify role")
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("User to manually verify")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName("email")
                .setDescription("Email to set for the user")
                .setRequired(true),
        )
        .addBooleanOption((option) =>
            option
                .setName("force")
                .setDescription("Force verification, clears email from existing user if it's already in use elsewhere")
                .setRequired(false),
        );

/**
 * Why an admin can't verify someone with this email, null if they can
 * The teacher role comes from the email and a typed email isn't checked by the form, so only an admin can use a teacher email
 * (it also can't be saved without the role, the verify button would hand the role out later)
 */
function FindEmailProblem(email: string): string | null {
    // a + makes an alias of another address, the same mailbox could get a second account
    if (email.includes("+")) {
        return "Emails with a + in them are not allowed, they are aliases of another address. Use the address without it.";
    }

    // alumni can have any email, but it has to be one
    if (!IsEmail(email)) return "That doesn't look like an email address.";

    return null;
}

/**
 * Makes the email free for this user: it can be on another account in this server, which is cleared if the force option is on
 * @returns false if the email can't be used, the moderator has been told why
 */
async function FreeUpEmail(interaction: ChatInputCommandInteraction, guildId: string, user: User, email: string, force: boolean): Promise<boolean> {
    // the email is unique over all servers, so this finds it in other servers too (and if it is already theirs)
    const existingProfile = await FindByValue("email", email);
    const isSameUser = existingProfile?.discordId === user.id && existingProfile.serverId === guildId;
    if (!existingProfile || isSameUser) return true;

    if (existingProfile.serverId !== guildId) {
        await interaction.editReply("This email is already in use by another account. On a different server, please contact Mumin.");
        return false;
    }

    if (!force) {
        await interaction.editReply({
            content: "This email is already associated with another account. Use the force option to override.",
        });
        return false;
    }

    // the profile has to be found by the discord id and server, the id of the profile row is something else
    const cleared = await UpdateProfile(existingProfile.discordId, existingProfile.serverId, { email: null });
    if (cleared !== null) {
        await interaction.editReply("I couldn't clear the email from the other account, nothing was changed.");
        return false;
    }

    await SendLog(interaction.client, guildId, `<@${interaction.user.id}> removed the email of <@${existingProfile.discordId}> to verify <@${user.id}> with it.`);
    return true;
}

export default async function command(
    interaction: ChatInputCommandInteraction
) {
    if (!interaction.guild) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Checks for admin
    if (!(await HasPermission(interaction, PermissionFlagsBits.Administrator))) return;

    const guild = interaction.guild;
    const user = interaction.options.getUser("user", true);
    // lowercase, emails are compared as typed so Name@lbs.se would be a different one from name@lbs.se
    const email = interaction.options.getString("email", true).trim().toLowerCase();
    const force = interaction.options.getBoolean("force") ?? false;

    const problem = FindEmailProblem(email);
    if (problem) {
        await interaction.editReply(problem);
        return;
    }

    if (!(await FreeUpEmail(interaction, guild.id, user, email, force))) return;

    const saved = await UpdateProfile(user.id, guild.id, { email });
    if (saved === PROFILE_DUPLICATE) {
        await interaction.editReply("That email is still in use by another account, nothing was changed.");
        return;
    }
    if (saved !== null) {
        await interaction.editReply("I couldn't save the email, check the console.");
        return;
    }

    // gives the roles, the verify answers are only kept in memory, if they are gone the member gets told to pick them again
    const member = await guild.members.fetch(user.id).catch(() => null);
    const completed = member ? await CompleteVerification(member, email) : false;

    let content = "The email was saved, but they aren't in the server so no roles were given.";
    if (member && completed) {
        content = "User manually verified.";
    } else if (member) {
        content = "The email was saved, but I couldn't give the roles (check that my role is above them). They can press the verify button to get them.";
    }

    await interaction.editReply({ content });

    await SendLog(interaction.client, guild.id, `<@${user.id}> has been manually verified by <@${interaction.user.id}>.`);
}
