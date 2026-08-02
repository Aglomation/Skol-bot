import type{
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    Client,
    GuildMember,
    SlashCommandSubcommandBuilder,
} from "discord.js";

import { ChannelType, GuildPremiumTier, MessageFlags, OverwriteType } from "discord.js";
import { GetServerConfig } from "../../../utils/configManager.js";

const SETTINGS = {
    BITRATE: "Bitrate:bitrate",
    USER_LIMIT: "User Limit:user_limit",
    NAME: "Name:name",
    WHITELIST: "Whitelist:whitelist",
    OPERATORS: "Operators:operators",
    INVITE: "Invite:invite",
    VISIBILITY: "Visibility:visibility",
    TYPE: "Type:type",
};
/*
 * auser: Autocomplete for all users in the server
 * puser: Autocomplete for all users in the server who are currently in the channel
 * none: No autocomplete
 * achannel: Autocomplete for all channels in the server
 * pchannel: Autocomplete for all channels in the server that the user has permission to manage / move members which is basically manage
*/
type DynamicChoice = "auser" | "puser" | "none" | "achannel" | "pchannel";

const SETTING_CHOICES: Record<string, { name: string; value: string }[] | DynamicChoice> = {
    [SETTINGS.BITRATE]: [
        { name: "8000 bps (Very Low)", value: "8000" },
        { name: "32000 bps", value: "32000" },
        { name: "64000 bps (Normal)", value: "64000" },
        { name: "96000 bps", value: "96000" },
        { name: "128000 bps (High)", value: "128000" },
        { name: "256000 bps (Ultra)", value: "256000" },
        { name: "384000 bps (Placebo)", value: "384000" },
    ],
    [SETTINGS.USER_LIMIT]: [
        { name: "Unlimited", value: "0" },
        { name: "2 Users", value: "2" },
        { name: "4 Users", value: "4" },
        { name: "10 Users", value: "10" },
        { name: "99 Users (Max)", value: "99" },
    ],
    [SETTINGS.NAME]: "none",
    [SETTINGS.WHITELIST]: [
        { name: "Enable (True)", value: "true" },
        { name: "Disable (False)", value: "false" },
    ],
    [SETTINGS.OPERATORS]: "puser",
    [SETTINGS.INVITE]: "auser",
    [SETTINGS.VISIBILITY]: [
        { name: "Everyone", value: "Everyone" },
        { name: "Join Only", value: "Join Only" },
    ],
    [SETTINGS.TYPE]: [
        { name: "Normal", value: "normal" },
        { name: "Spoiler", value: "spoiler" },
        { name: "NSFW", value: "nsfw" },
    ],
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
                channel.permissionsFor(interaction.user)?.has("MoveMembers")
            ).first(25);
            if (!channels) return interaction.respond([]);

            const choices = channels
                .map((channel) => ({ name: channel.name, value: channel.id }));

            return interaction.respond(choices);
        }

        case "setting": {
            const choices = Object.keys(SETTING_CHOICES)
                .filter((name) => name.split(":")[0].toLowerCase().includes(focusedValue))
                .slice(0, 25)
                .map((name) => ({ name: name.split(":")[0], value: name }));

            return interaction.respond(choices);
        }

        case "value": {
            const selectedSetting = interaction.options.getString("setting");
            if (!selectedSetting || !SETTING_CHOICES[selectedSetting]) {
                return interaction.respond([
                    { name: "Please select a valid setting first.", value: "invalid" },
                ]);
            }

            const choiceConfig = SETTING_CHOICES[selectedSetting];

            // Check if the choice is an array of choices
            if (Array.isArray(choiceConfig)) {
                let filteredChoices = choiceConfig;

                // Filters out bitrate choices that exceed the max allowed bitrate for the current server
                if (selectedSetting === SETTINGS.BITRATE) {
                    let maxBitrate = 96000; 
                    switch (interaction.guild?.premiumTier) {
                        case GuildPremiumTier.Tier1:
                            maxBitrate = 128000;
                            break;
                        case GuildPremiumTier.Tier2:
                            maxBitrate = 256000;
                            break;
                        case GuildPremiumTier.Tier3:
                            maxBitrate = 384000;
                            break;
                    }
                    
                    filteredChoices = filteredChoices.filter(choice => parseInt(choice.value, 10) <= maxBitrate);
                }
                const choices = filteredChoices
                    .filter(
                        (val) =>
                            val.name.toLowerCase().includes(focusedValue) ||
                            val.value.toLowerCase().includes(focusedValue)
                    )
                    .slice(0, 25);

                return interaction.respond(choices);
            }

            // Check if the choice is a dynamic choice
            if (typeof choiceConfig === "string") {
                if (choiceConfig === "none") {
                    return interaction.respond([ { name: "No autocomplete, write to your hearts content.", value: focusedOption.value } ]);
                }

                if (choiceConfig === "auser" || choiceConfig === "puser") {
                    const channelId = interaction.options.getString("channel");
                    const channel = channelId ? guild.channels.cache.get(channelId) : null;
                    if (choiceConfig === "puser" && !channel) {
                        return interaction.respond([
                            { name: "Can't provide member choices without a valid channel.", value: "0" }
                        ]);
                    }
                    const members = guild.members.cache
                        .filter((member) => {
                            if (member.user.bot) return false;
                            const matchesName =
                                member.user.username.toLowerCase().includes(focusedValue) ||
                                member.nickname?.toLowerCase().includes(focusedValue) ||
                                member.id.includes(focusedValue);

                            if (choiceConfig === "puser" && channel) {
                                return matchesName && channel.permissionsFor(member).has("Connect");
                            }
                            return Boolean(matchesName);
                        })
                        .first(25);

                    return interaction.respond(
                        members.map((member) => ({
                            name: `${member.user.username} ${member.nickname ? `(${member.nickname})` : ""}`,
                            value: member.id,
                        }))
                    );
                }

                if (
                    choiceConfig === "achannel" ||
                    choiceConfig === "pchannel"
                ) {
                    const channels = guild.channels.cache
                        .filter((channel) => {
                            if (
                                channel.type !== ChannelType.GuildVoice ||
                                channel.parentId !== TEMP_CATEGORY ||
                                channel.id === TEMP_CHANNEL 
                            ) return false;

                            const matchesName = channel.name.toLowerCase().includes(focusedValue);

                            // pchannel requires the user to have MoveMembers permission in the channel
                            if (choiceConfig === "pchannel") {
                                return matchesName && channel.permissionsFor(interaction.user)?.has("MoveMembers");
                            }
                            return matchesName;
                        })
                        .first(25);

                    return interaction.respond(
                        channels.map((channel) => ({
                            name: channel.name,
                            value: channel.id,
                        }))
                    );
                }
            }

            return interaction.respond([]);
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
                let maxBitrate = 96000; // Default max bitrate
                switch (interaction.guild.premiumTier) {
                    case null:
                        break;
                    case GuildPremiumTier.Tier1:
                        maxBitrate = 128000;
                        break;
                    case GuildPremiumTier.Tier2:
                        maxBitrate = 256000;
                        break;
                    case GuildPremiumTier.Tier3:
                        maxBitrate = 384000;
                        break;
                    default:
                        break;
                }

                if (Number.isNaN(bitrateValue) || bitrateValue < 8000 || bitrateValue > maxBitrate) {
                    return interaction.editReply({ content: `Invalid bitrate. Please provide a number between 8000 and ${maxBitrate}.` });
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
                if (value.toLowerCase() !== "true" && value.toLowerCase() !== "false") {
                    const currentState = channel.permissionOverwrites.cache.get(interaction.guild.roles.everyone.id)?.deny.has("Connect");
                    return interaction.editReply({ content: `Current whitelist is set to ${currentState ? "disabled" : "enabled"}` });
                };
                
                await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                    Connect: !isEnabled, 
                });
                
                return interaction.editReply({ content: `Whitelist for **<#${channel.id}>** has been **${isEnabled ? "enabled" : "disabled"}**.` });
            }

            case SETTINGS.OPERATORS: {
                // Strip out formatting from mentions
                const userId = value.replace(/[<@!>]/g, "");
                const user = interaction.guild.members.cache.get(userId) as GuildMember;
                
                if (!user || interaction.user.id === userId) {
                    return interaction.editReply({ content: "Invalid user ID. Please provide a valid user." });
                }
                const currentperms = channel.permissionOverwrites.cache.get(userId)?.allow.has("MoveMembers");

                await channel.permissionOverwrites.edit(userId, {
                    Connect: true,
                    Speak: true,
                    MoveMembers: !currentperms,
                });

                if (!currentperms) {
                    return interaction.editReply({ content: `User <@${userId}> has been removed as an operator for **<#${channel.id}>**.` });
                }

                return interaction.editReply({ content: `User <@${userId}> has been added as an operator for **<#${channel.id}>**.` });
            }
            case SETTINGS.VISIBILITY: {
                switch (value.toLowerCase()) {
                    case "everyone":
                        await channel.permissionOverwrites.edit(
                            await GetServerConfig(interaction.guild.id, "verifiedRoleId") as string || interaction.guild.roles.everyone,
                            { ViewChannel: true }
                        );
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

                        await channel.permissionOverwrites.edit(
                            await GetServerConfig(interaction.guild.id, "verifiedRoleId") as string || interaction.guild.roles.everyone,
                            { ViewChannel: false }
                        );

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