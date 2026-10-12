import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { SendLog } from "../../../utils/logChannel.js";
import { HasPermission } from "../../../utils/permissions.js";
import { FindByValue, PROFILE_DUPLICATE, UpdateProfile } from "../../../utils/profileManager.js";
import { CompleteVerification } from "../../../utils/verifyFlow.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
		.setName("manualverify")
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
                .setDescription("Force verification, clears email from existing user if it's already in use elsewhere.")
                .setRequired(false),
        );

export default async function command(
	interaction: ChatInputCommandInteraction,
	client: Client,
) {
    if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Ban Members assumes you're a moderator or admin
    if (!(await HasPermission(interaction, PermissionFlagsBits.BanMembers))) return;
    
    const user = interaction.options.getUser("user", true);
    // lowercase, emails are compared as typed so Name@lbs.se would be a different one from name@lbs.se
    const email = interaction.options.getString("email", true).trim().toLowerCase();
    const force = interaction.options.getBoolean("force") ?? false;
    
    // the email can belong to someone else (this is also how it is found again if it is already theirs)
    const existingProfile = await FindByValue("email", email);
    const isSameUser = existingProfile?.discordId === user.id && existingProfile.serverId === interaction.guild.id;

    if (existingProfile && !isSameUser) {
        if (!force) {
            await interaction.editReply({
                content: "This email is already associated with another account. Use the force option to override.",
            });
            return;
        }

        // the profile has to be found by the discord id and server, the id of the profile row is something else
        await UpdateProfile(existingProfile.discordId, existingProfile.serverId, { email: null });
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
    if (member) await CompleteVerification(member, email);

    await interaction.editReply({
        content: member
            ? "User manually verified."
            : "The email was saved, but they aren't in the server so no roles were given.",
    });

    await SendLog(client, interaction.guild.id, `<@${user.id}> has been manually verified by <@${interaction.user.id}>.`);
    }
