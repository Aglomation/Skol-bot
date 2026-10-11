import type { ChatInputCommandInteraction, Client, GuildMember, SlashCommandSubcommandBuilder, TextChannel } from "discord.js";
import {
	MessageFlags,
    PermissionsBitField,
} from "discord.js";
import { GetServerConfig } from "../../../utils/configManager.js";
import { FindByValue, UpdateProfile } from "../../../utils/profileManager.js";
import { ApplyVerifyRoles, NotifyNoRoleAnswers, TakePendingRoles } from "../../../utils/verifyFlow.js";


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

    // Check if the user has the "Ban Members" permission, which assumes you're a moderator or admin
    const executor = interaction.member as GuildMember;

    if (!executor.permissions.has(PermissionsBitField.Flags.BanMembers) && await GetServerConfig(interaction.guild.id, "isDevServer") === false) {
        await interaction.editReply("You don't have permission to use this.");
        return;
    }
    
    const user = interaction.options.getUser("user", true);
    const email = interaction.options.getString("email", true);
    const force = interaction.options.getBoolean("force") ?? false;
    const logChannel = client.channels.cache.get(
        await GetServerConfig(interaction.guild.id, "logChannel") as string
    ) as TextChannel | undefined;
    
    if (await FindByValue("email", email)) {
        if (!force) {
            await interaction.editReply({
                content: "This email is already associated with another account. Use the force option to override.",
            });
            return;
        }

        const existingProfile = await FindByValue("email", email);
        if (existingProfile) {
            await UpdateProfile(existingProfile.id, interaction.guild.id, { email: null });
        }
    }

    await UpdateProfile(user.id, interaction.guild.id, { email });

    // gives the verify role
    const member = interaction.guild?.members.cache.get(user.id);
    const verifyRoleId = await GetServerConfig(interaction.guild.id, "verifiedRoleId") as string | undefined;
    if (member && verifyRoleId) {
        await member.roles.add(verifyRoleId);
    }
    // the answers from the verify questions (only kept in memory), if they are gone the member gets told to pick them again
    if (member) {
        const pending = TakePendingRoles(interaction.guild.id, user.id);
        if (pending) await ApplyVerifyRoles(member, pending.roleIds, pending.asked);
        else await NotifyNoRoleAnswers(member);
    }

    await interaction.editReply({
        content: "User manually verified.",
    });

    if (logChannel) {
        await logChannel.send({
            content: `User ${user.tag} has been manually verified by ${interaction.user.tag}.`,
        });
    }
}