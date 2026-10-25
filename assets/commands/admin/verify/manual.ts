import type { ChatInputCommandInteraction, GuildMember, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { IsEmail, IsTeacherEmail } from "../../../../utils/emails.js";
import { SendLog } from "../../../../utils/logChannel.js";
import { HasPermission } from "../../../../utils/permissions.js";
import { FindByValue, PROFILE_DUPLICATE, UpdateProfile } from "../../../../utils/profileManager.js";
import { CompleteVerification } from "../../../../utils/verifyFlow.js";

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

export default async function command(
	interaction: ChatInputCommandInteraction
) {
    if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Ban Members assumes you're a moderator or admin
    if (!(await HasPermission(interaction, PermissionFlagsBits.BanMembers))) return;

    const user = interaction.options.getUser("user", true);
    // lowercase, emails are compared as typed so Name@lbs.se would be a different one from name@lbs.se
    const email = interaction.options.getString("email", true).trim().toLowerCase();
    const force = interaction.options.getBoolean("force") ?? false;

    // alumni can have any email, but it has to be one
    if (!IsEmail(email)) {
        await interaction.editReply("That doesn't look like an email address.");
        return;
    }

    // the teacher role comes from the email, and a typed email isn't checked by the form
    // it also can't be saved without the role, the verify button would hand the role out later
    const isAdmin = (interaction.member as GuildMember).permissions.has(PermissionFlagsBits.Administrator);
    if (IsTeacherEmail(email) && !isAdmin) {
        await interaction.editReply("That is a teacher email, only an admin can verify someone with it.");
        return;
    }

    // the email can belong to someone else (this is also how it is found again if it is already theirs)
    // it is unique over all servers, so this finds it in other servers too
    const existingProfile = await FindByValue("email", email);
    const isSameUser = existingProfile?.discordId === user.id && existingProfile.serverId === interaction.guild.id;

    if (existingProfile && !isSameUser) {
        // what happens in another server is not for this one to see or change
        if (existingProfile.serverId !== interaction.guild.id) {
            await interaction.editReply("This email is already in use by another account.");
            return;
        }

        if (!force) {
            await interaction.editReply({
                content: "This email is already associated with another account. Use the force option to override.",
            });
            return;
        }

        // the profile has to be found by the discord id and server, the id of the profile row is something else
        const cleared = await UpdateProfile(existingProfile.discordId, existingProfile.serverId, { email: null });
        if (cleared !== null) {
            await interaction.editReply("I couldn't clear the email from the other account, nothing was changed.");
            return;
        }

        await SendLog(interaction.client, interaction.guild.id, `<@${interaction.user.id}> removed the email of <@${existingProfile.discordId}> to verify <@${user.id}> with it.`);
    }

    const saved = await UpdateProfile(user.id, interaction.guild.id, { email });
    if (saved === PROFILE_DUPLICATE) {
        await interaction.editReply("That email is still in use by another account, nothing was changed.");
        return;
    }
    if (saved !== null) {
        await interaction.editReply("I couldn't save the email, check the console.");
        return;
    }

    // gives the roles, the verify answers are only kept in memory, if they are gone the member gets told to pick them again
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    const completed = member ? await CompleteVerification(member, email) : false;

    let content = "The email was saved, but they aren't in the server so no roles were given.";
    if (member && completed) {
        content = "User manually verified.";
    } else if (member) {
        content = "The email was saved, but I couldn't give the roles (check that my role is above them). They can press the verify button to get them.";
    }

    await interaction.editReply({ content });

    await SendLog(interaction.client, interaction.guild.id, `<@${user.id}> has been manually verified by <@${interaction.user.id}>.`);
}
