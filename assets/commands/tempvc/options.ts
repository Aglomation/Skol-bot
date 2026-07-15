import type{
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    Client,
    SlashCommandSubcommandBuilder,
} from "discord.js";

import { ChannelType, MessageFlags } from "discord.js";
export const options = new Map([
    ["Bitrate:bitrate", [8000, 32000, 64000, 96000, 128000, 256000]],
    ["User Limit:user_limit", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
    ["Name:name", []],
    ["Whitelist:whitelist", [true, false]],
    ["Operators (userid):operators", []],
])
export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
        .setName("options")
        .setDescription("Customize your temporary voice channel settings")
        .addStringOption((option) =>
            option
                .setName("channel")
                .setDescription("The channel where your data will be sent")
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption((option) =>
            option
                .setName("setting")
                .setDescription("The setting you want to change")
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption((option) =>
            option
                .setName("value")
                .setDescription("The value you want to set for the selected setting")
                .setRequired(true)
                .setAutocomplete(true)
        );

export const autocomplete = async (interaction: AutocompleteInteraction, _client: Client) => {
    const focusedOption = interaction.options.getFocused(true);
    const optionName = focusedOption.name;
    const focusedValue = focusedOption.value.toLowerCase();

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
    } else if (optionName === "setting") {
        const choices = Array.from(options.keys())
            .filter((name) => name.split(":")[1].toLowerCase().includes(focusedValue))
            .slice(0, 25)
            .map((name) => ({ name: name.split(":")[0], value: name }));

        return interaction.respond(choices);
        
    } else if (optionName === "value") {
        const selectedSetting = interaction.options.getString("setting");
        if (!selectedSetting) return interaction.respond([]);

        const settingValues = options.get(selectedSetting) || [];
        
        const choices = settingValues
            .map(String)
            .filter((val) => val.toLowerCase().includes(focusedValue))
            .slice(0, 25)
            .map((val) => ({ name: val, value: val }));

        return interaction.respond(choices);
    };
};

export default async function command(
	interaction: ChatInputCommandInteraction,
	_client: Client,
) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = interaction.guild?.channels.cache.get(interaction.options.getString("channel", true) || "");
    const setting = interaction.options.getString("setting", true);
    const value = interaction.options.getString("value", true);
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

    if (!options.has(setting)) {
        await interaction.editReply({
            content: "Invalid setting selected. Please select a valid setting.",
        });
        return;
    }

    if (setting === "Bitrate:bitrate") {
        const bitrateValue = parseInt(value, 10);
        if (bitrateValue < 8000 || bitrateValue > 256000) {
            await interaction.editReply({
                content: "Invalid bitrate value. Please select a value between 8000 and 256000.",
            });
            return;
        }
        await channel.setBitrate(bitrateValue).catch(() => null);
        await interaction.editReply({
            content: `Bitrate for channel **<#${channel.id}>** has been set to **${bitrateValue}**.`,
        });
        return;
    } else if (setting === "User Limit:user_limit") {
        const userLimitValue = parseInt(value, 10);
        if (userLimitValue < 0 || userLimitValue > 99) {
            await interaction.editReply({
                content: "Invalid user limit value. Please select a value between 0 and 99.",
            });
            return;
        }
        await channel.setUserLimit(userLimitValue).catch(() => null);
        await interaction.editReply({
            content: `User limit for channel **<#${channel.id}>** has been set to **${userLimitValue}**.`,
        });
        return;
    } else if (setting === "Name:name") {
        if (value.length < 1 || value.length > 100) {
            await interaction.editReply({
                content: "Invalid name value. Please select a name between 1 and 100 characters.",
            });
            return;
        }
        await channel.setName(value).catch(() => null);
        await interaction.editReply({
            content: `Name for channel **<#${channel.id}>** has been set to **${value}**.`,
        });
        return;
    } else if (setting === "Whitelist:whitelist") {
        const whitelistValue = value.toLowerCase() === "true";

        await channel.permissionOverwrites.edit(interaction.guild?.roles.everyone, {
            Connect: !whitelistValue,
        }).catch(() => null);

        await interaction.editReply({
            content: `Whitelist for channel **<#${channel.id}>** has been set to **${whitelistValue ? "enabled" : "disabled"}**.`,
        });
        return;
    } else if (setting === "Operators (userid):operators") {
        const userId = value;
        const user = await interaction.guild?.members.fetch(userId).catch(() => null);
        if (!user) {
            await interaction.editReply({
                content: "Invalid user ID. Please provide a valid user ID.",
            });
            return;
        }

        await channel.permissionOverwrites.edit(userId, {
            Connect: true,
            Speak: true,
            MoveMembers: true,
        }).catch(() => null);

        await interaction.editReply({
            content: `User <@${userId}> has been added as an operator for channel **<#${channel.id}>**.`,
        });
        return;
    }




};