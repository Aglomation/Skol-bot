import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { GetServerConfig } from "../../../utils/configManager.js";
import { HasPermission } from "../../../utils/permissions.js";
import { GetProfile, PROFILE_FAILED, UpdateProfile } from "../../../utils/profileManager.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
		.setName("clearverify")
        .setDescription("Removes the email and the verify roles from the selected user")
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("User to clear the email for")
                .setRequired(true),
        );

export default async function command(
	interaction: ChatInputCommandInteraction,
) {
    if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Ban Members assumes you're a moderator or admin
    if (!(await HasPermission(interaction, PermissionFlagsBits.BanMembers))) return;

    const user = interaction.options.getUser("user", true);

    // only touch the profile if there is something to clear, UpdateProfile would make an empty one
    const profile = await GetProfile(user.id, interaction.guild.id);
    if (profile?.email) {
        const saved = await UpdateProfile(user.id, interaction.guild.id, { email: null });
        if (saved === PROFILE_FAILED) {
            await interaction.editReply("I couldn't clear the email, check the console.");
            return;
        }
    }

    // removes the verified role, and the teacher role since that came from the email
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
        await interaction.editReply("Email cleared. They aren't in the server, so no roles were removed.");
        return;
    }
    
    const roleIds = [
        await GetServerConfig(interaction.guild.id, "verifiedRoleId"),
        await GetServerConfig(interaction.guild.id, "teacherRoleId"),
    ].filter((id): id is string => !!id && member.roles.cache.has(id));

    if (roleIds.length > 0) await member.roles.remove(roleIds);
    
    await interaction.editReply({
        content: "Email and verify roles cleared for the user.",
    });
    }
