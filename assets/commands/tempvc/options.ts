import type{
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    Client,
    SlashCommandSubcommandBuilder,
} from "discord.js";

import { ChannelType, MessageFlags, OverwriteType } from "discord.js";
import { GetServerConfig } from "../../../utils/configManager.js";

const SETTINGS = {
    BITRATE: "Bitrate:bitrate",
    USER_LIMIT: "User Limit:user_limit",
    NAME: "Name:name",
    WHITELIST: "Whitelist:whitelist",
    OPERATORS: "Operators (userid):operators",
    VISIBILITY: "Visibility:visibility",
    TYPE: "Type:type",
};

const SETTING_CHOICES: Record<string, string[]> = {
    [SETTINGS.BITRATE]: ["8000", "32000", "64000", "96000", "128000", "256000"],
    [SETTINGS.USER_LIMIT]: ["0", "99"], // 0 = unlimited, up to 99
    [SETTINGS.NAME]: [],
    [SETTINGS.WHITELIST]: ["true", "false"],
    [SETTINGS.OPERATORS]: [],
    [SETTINGS.VISIBILITY]: ["Everyone", "Join Only"],
    [SETTINGS.TYPE]: ["normal", "spoiler", "nsfw"],
};
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
    const guild = interaction.guild;
    if (!guild) return interaction.respond([]);

    const focusedOption = interaction.options.getFocused(true);
    const optionName = focusedOption.name;
    const focusedValue = focusedOption.value.toLowerCase();

    const TEMP_CHANNEL = await GetServerConfig(guild.id, "tempVcMainChannel") as string;
    const TEMP_CATEGORY = await GetServerConfig(guild.id, "tempvcCategory") as string;

    switch (optionName) {
        case "channel": {
            const channels = interaction.guild?.channels.cache.filter((channel) =>
                channel.type === ChannelType.GuildVoice &&
                channel.id !== TEMP_CHANNEL &&
                channel.parentId === TEMP_CATEGORY &&
                channel.permissionsFor(interaction.user)?.has("Connect")
            );
            if (!channels) return interaction.respond([]);

            const choices = channels
                .map((channel) => ({ name: channel.name, value: channel.id }))
                .slice(0, 25);

            return interaction.respond(choices);
        }

        case "setting": {
            const choices = Object.keys(SETTING_CHOICES)
                .filter((name) => name.split(":")[1].toLowerCase().includes(focusedValue))
                .slice(0, 25)
                .map((name) => ({ name: name.split(":")[0], value: name }));

            return interaction.respond(choices);
        }

        case "value": {
            const selectedSetting = interaction.options.getString("setting");
            if (!selectedSetting || !SETTING_CHOICES[selectedSetting]) {
                return interaction.respond(
                    ["Please select a valid setting first."].map((val) => ({ name: val, value: "" }))
                );
            }

            const choices = SETTING_CHOICES[selectedSetting]
                .filter((val) => val.toLowerCase().includes(focusedValue))
                .slice(0, 25)
                .map((val) => ({ name: val, value: val }));

            return interaction.respond(choices);
        }

        default:
            return interaction.respond([]);
    }
};

export default async function command(
	interaction: ChatInputCommandInteraction,
	_client: Client,
) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!interaction.guild) {
        return interaction.editReply({ content: "This command can only be used in a server." });
    }
    const channel = interaction.guild?.channels.cache.get(interaction.options.getString("channel", true) || "");
    const setting = interaction.options.getString("setting", true);
    const value = interaction.options.getString("value", true);

    const TEMP_CHANNEL = await GetServerConfig(interaction.guild.id, "tempVcMainChannel") as string;
    const TEMP_CATEGORY = await GetServerConfig(interaction.guild.id, "tempvcCategory") as string;

    // Validate Channel
    if (
        !channel ||
        channel.type !== ChannelType.GuildVoice ||
        channel.id === TEMP_CHANNEL ||
        channel.parentId !== TEMP_CATEGORY ||
        !channel.permissionsFor(interaction.user)?.has("MoveMembers") // Acting as an ownership check
    ) {
        return interaction.editReply({
            content: "Invalid channel selected. Please select a valid temporary voice channel that you own.",
        });
    }

    // Validate Setting
    if (!(setting in SETTING_CHOICES)) {
        return interaction.editReply({
            content: "Invalid setting selected. Please select a valid setting from the autocomplete list.",
        });
    }
    try {
        switch (setting) {
            case SETTINGS.BITRATE: {
                const bitrateValue = parseInt(value, 10);
                if (Number.isNaN(bitrateValue) || bitrateValue < 8000 || bitrateValue > 256000) {
                    return interaction.editReply({ content: "Invalid bitrate. Please provide a number between 8000 and 256000." });
                }
                
                await channel.setBitrate(bitrateValue);
                return interaction.editReply({ content: `Bitrate for **<#${channel.id}>** has been set to **${bitrateValue}** bps.` });
            }

            case SETTINGS.USER_LIMIT: {
                const userLimitValue = parseInt(value, 10);
                if (Number.isNaN(userLimitValue) || userLimitValue < 0 || userLimitValue > 99) {
                    return interaction.editReply({ content: "Invalid user limit. Please provide a number between 0 and 99." });
                }
                
                await channel.setUserLimit(userLimitValue);
                return interaction.editReply({ content: `User limit for **<#${channel.id}>** has been set to **${userLimitValue}**.` });
            }

            case SETTINGS.NAME: {
                if (value.length < 1 || value.length > 100) {
                    return interaction.editReply({ content: "Invalid name. Please provide a name between 1 and 100 characters." });
                }
                
                await channel.setName(value);
                return interaction.editReply({ content: `Channel name has been updated to **${value}**.` });
            }

            case SETTINGS.WHITELIST: {
                const isEnabled = value.toLowerCase() === "true";
                
                await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                    Connect: !isEnabled, 
                });
                
                return interaction.editReply({ content: `Whitelist for **<#${channel.id}>** has been **${isEnabled ? "enabled" : "disabled"}**.` });
            }

            case SETTINGS.OPERATORS: {
                // Strip out formatting from mentions
                const userId = value.replace(/[<@!>]/g, "");
                const user = interaction.guild.members.cache.get(userId);
                
                if (!user) {
                    return interaction.editReply({ content: "Invalid user ID or mention. Please provide a valid user currently in the server." });
                }

                await channel.permissionOverwrites.edit(userId, {
                    Connect: true,
                    Speak: true,
                    MoveMembers: true,
                });
                
                return interaction.editReply({ content: `User <@${userId}> has been added as an operator for **<#${channel.id}>**.` });
            }
            case SETTINGS.VISIBILITY: {
                switch (value.toLowerCase()) {
                    case "everyone":
                        await channel.permissionOverwrites.edit(interaction.guild.roles.cache.get(await GetServerConfig(interaction.guild.id, "verifiedRoleId") as string) || "", {
                            ViewChannel: true,
                        });
                        return interaction.editReply({ content: `Visibility for **<#${channel.id}>** has been set to **Everyone**.` });
                    case "join only": {
                        const allowedUsers = channel.permissionOverwrites.cache.filter(
                            (overwrite) => 
                                overwrite.type === OverwriteType.Member && 
                                overwrite.allow.has("Connect")
                        );
                        
                        for (const overwrite of allowedUsers.values()) {
                            await channel.permissionOverwrites.edit(overwrite.id, {
                                ViewChannel: true,
                            });
                        }

                        await channel.permissionOverwrites.edit(interaction.guild.roles.cache.get(await GetServerConfig(interaction.guild.id, "verifiedRoleId") as string) || "", {
                            ViewChannel: false,
                        });

                        return interaction.editReply({ content: `Visibility for **<#${channel.id}>** has been set to **Join Only**.` });
                    }
                    default:
                        return interaction.editReply({ content: "Invalid visibility option. Please choose from Everyone or Join Only." });
                }
            }
            case SETTINGS.TYPE: {
                // Spoiler (flags: ChannelFlagsBitField { bitfield: 2097152 },)
                // Normal 
                // NSFW (not shown by default in autocomplete, but can be set)
                
                switch (value.toLowerCase()) {
                    case "normal":
                        await channel.edit({ nsfw: false, flags: 0 });
                        return interaction.editReply({ content: `Visibility for **<#${channel.id}>** has been set to **Normal**.` });
                    case "spoiler":
                        await channel.edit({ nsfw: false, flags: 2097152 });
                        return interaction.editReply({ content: `Visibility for **<#${channel.id}>** has been set to **Spoiler**.` });
                    case "nsfw":
                        await channel.edit({ nsfw: true, flags: 0 });
                        return interaction.editReply({ content: `Visibility for **<#${channel.id}>** has been set to **NSFW**.` });
                    default:
                        return interaction.editReply({ content: "Invalid visibility option. Please choose from Normal, NSFW, or Spoiler." });
                }
            }

        }
    } catch (error) {
        console.error("Failed to update temporary channel setting:", error);
        return interaction.editReply({
            content: "An error occurred while trying to apply the setting.",
        });
    }




};