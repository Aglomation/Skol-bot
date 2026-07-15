import type{
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    Client,
    SlashCommandSubcommandBuilder,
} from "discord.js";

import { ChannelType, MessageFlags } from "discord.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
        .setName("invite")
        .setDescription("Invite users to your temporary voice channel")
        .addStringOption((option) =>
            option
                .setName("channel")
                .setDescription("The channel where your data will be sent")
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("The user you want to whitelist or remove from the whitelist")
                .setRequired(true)
        );

export const autocomplete = async (interaction: AutocompleteInteraction, _client: Client) => {
    const focusedOption = interaction.options.getFocused(true);
    const optionName = focusedOption.name;

    if (optionName === "channel") {
        const channels = interaction.guild?.channels.cache.filter((channel) => 
            channel.type === ChannelType.GuildVoice && 
            channel.id !== "1526740160853577909" &&
            channel.parentId === "1526742944818659378" &&
            channel.permissionsFor(interaction.user)?.has("Connect")
        );
        if (!channels) return interaction.respond([]);

        const choices = channels
            .map((channel) => ({ name: channel.name, value: channel.id }))
            .slice(0, 25);

        return interaction.respond(choices);
    }
};

export default async function command(
	interaction: ChatInputCommandInteraction,
	_client: Client,
) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = interaction.guild?.channels.cache.get(interaction.options.getString("channel", true) || "");
    const user = interaction.options.getUser("user", true);

    if (!interaction.guild) {
        await interaction.editReply({
            content: "This command can only be used in a server.",
        });
        return;
    }
    if (
        channel?.type !== ChannelType.GuildVoice ||
        channel?.id === "1526740160853577909" ||
        channel?.parentId !== "1526742944818659378" ||
        !channel?.permissionsFor(interaction.user)?.has("MoveMembers")
    ) {
        await interaction.editReply({
            content: "Invalid channel selected. Please select a valid temporary voice channel.",
        });
        return;
    }
    const currentperms = channel.permissionOverwrites.cache.get(user.id);
    
    await channel.permissionOverwrites.edit(user, {
        Connect: !currentperms?.allow.has("Connect"),
    }).catch(() => null);

    await interaction.editReply({
        content: `${user.tag} has been ${currentperms?.allow.has("Connect") ? "removed from" : "added to"} the whitelist for <#${channel.id}>.`,
    });

};