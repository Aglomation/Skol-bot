import type { ChatInputCommandInteraction, Client, GuildMember, SlashCommandSubcommandBuilder } from "discord.js";
import {
	MessageFlags,
    PermissionsBitField,
} from "discord.js";
import { GetServerConfig } from "../../../utils/configManager.js";
import { UpdateProfile } from "../../../utils/profileManager.js";


export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
		.setName("clearverify")
		.setDescription("Removes the email from the selected user")
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("User to clear the email for")
                .setRequired(true),
        );

export default async function command(
	interaction: ChatInputCommandInteraction,
	_client: Client,
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

    await UpdateProfile(user.id, interaction.guild.id, { email: null });
    
    // removes the verify role
    const member = interaction.guild?.members.cache.get(user.id);
    if (member) {
        await member.roles.remove("1498832228145168514");
    }

    await interaction.editReply({
        content: "Verify role cleared for the user.",
    });
}