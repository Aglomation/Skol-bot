import type { VoiceState } from "discord.js";
import { ChannelType, Events, PermissionFlagsBits } from "discord.js";
import { GetServerConfig } from "../utils/configManager.js";

export default {
	name: Events.VoiceStateUpdate,
	once: false,
    async execute(oldState: VoiceState, newState: VoiceState) {
        // muting, deafening and streaming also end up here, only joining, leaving and moving matters
        if (oldState.channelId === newState.channelId) return;
        
        const guild = newState.guild;
        const tempChannelId = await GetServerConfig(guild.id, "tempVcMainChannel");
        const tempCategoryId = await GetServerConfig(guild.id, "tempvcCategory");

        // temporary voice channels aren't set up in this server
        if (!tempChannelId || !tempCategoryId) return;
            
        // Deletes the temporary channel they left when nobody is in it anymore
        const oldChannel = oldState.channel;
        if (
            oldChannel &&
            oldChannel.parentId === tempCategoryId &&
            oldChannel.id !== tempChannelId &&
            oldChannel.members.size === 0
        ) {
            await oldChannel.delete().catch(() => null);
            }

        // Joining the main channel makes a new temporary channel, this also works when they come from another temporary one
        const member = newState.member;
        if (newState.channelId !== tempChannelId || !member) return;

        const verifiedRoleId = await GetServerConfig(guild.id, "verifiedRoleId");

        try {
            const channel = await guild.channels.create({
                name: `${member.displayName.slice(0, 90)}'s VC`,
                type: ChannelType.GuildVoice,
                parent: tempCategoryId,
                bitrate: 96000,
                permissionOverwrites: [
                    {
                        id: member.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.Connect,
                            PermissionFlagsBits.Speak,
                            PermissionFlagsBits.MoveMembers,
                        ],
                    },
                    {
                        id: (verifiedRoleId && guild.roles.cache.get(verifiedRoleId)?.id) || guild.roles.everyone.id,
                        allow: [PermissionFlagsBits.ViewChannel],
                    },
                ],
            });

            await newState.setChannel(channel);
            await channel.send({
                content:
                    `Welcome to your temporary voice channel, <@${member.id}>!\n\n` +
                    `You can customize it with the \`/tempvc\` commands, like \`/tempvc name\`, \`/tempvc limit\` or \`/tempvc visibility\`.\n\n` +
                    `Example:\nTo invite someone to your channel, use \`/tempvc invite\`.\n\n` +
                    `Whitelist is by default disabled.`,
                }).catch(() => null);
        } catch (error) {
            console.error("Could not create a temporary voice channel:", error);
        }
	},
};
