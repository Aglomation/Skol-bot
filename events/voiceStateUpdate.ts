import type { GuildMember, VoiceChannel, VoiceState } from "discord.js";
import { ChannelType, Events, PermissionFlagsBits } from "discord.js";
import { CanCreateTempChannel, ForgetTempChannel, HandOverTempChannel, IsTempChannel, SetTempOwner } from "../features/tempVoice.js";
import { GetServerConfig } from "../utils/configManager.js";

const CHANNEL_BITRATE = 96000;
// discord allows 100 characters in a channel name, "'s VC" is added after the name
const MAX_OWNER_NAME_LENGTH = 90;

/**
 * The channel someone left: it is deleted when nobody is in it anymore, and otherwise passed on if the owner was the one who left
 * Channels that an admin put in the category by hand are not temporary, those stay
 */
async function CleanUpLeftChannel(oldState: VoiceState, joinChannelId: string, categoryId: string) {
    const channel = oldState.channel;
    if (!channel || !IsTempChannel(channel, joinChannelId, categoryId)) return;

    if (channel.members.size === 0) {
        ForgetTempChannel(channel.id);
        await channel.delete().catch(() => null);
    } else if (oldState.member) {
        await HandOverTempChannel(channel, oldState.member);
    }
}

/** Creates the channel of a member that joined the join channel, and moves them into it */
async function CreateTempChannel(joinState: VoiceState, member: GuildMember, categoryId: string) {
    // joining and leaving over and over would make a pile of channels
    if (!CanCreateTempChannel(member.id)) {
        await joinState.disconnect("Too many temporary channels at once").catch(() => null);
        return;
    }

    const guild = joinState.guild;
    const verifiedRoleId = await GetServerConfig(guild.id, "verifiedRoleId");

    let channel: VoiceChannel | null = null;
    try {
        channel = await guild.channels.create({
            name: `${member.displayName.slice(0, MAX_OWNER_NAME_LENGTH)}'s VC`,
            type: ChannelType.GuildVoice,
            parent: categoryId,
            bitrate: CHANNEL_BITRATE,
            permissionOverwrites: [
                {
                    id: member.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.MoveMembers],
                },
                {
                    // verified members can see the channel, and if there is no verified role everyone can
                    id: (verifiedRoleId && guild.roles.cache.get(verifiedRoleId)?.id) || guild.roles.everyone.id,
                    allow: [PermissionFlagsBits.ViewChannel],
                },
            ],
        });
        SetTempOwner(channel.id, member.id);

        await joinState.setChannel(channel);
        await channel
            .send({
                content:
                    `Welcome to your temporary voice channel, <@${member.id}>!\n\n` +
                    `You can customize it with the \`/tempvc\` commands, like \`/tempvc name\`, \`/tempvc limit\` or \`/tempvc visibility\`.\n\n` +
                    `Example:\nTo invite someone to your channel, use \`/tempvc invite\`.\n\n` +
                    `Whitelist is by default disabled.`,
            })
            .catch(() => null);
    } catch (error) {
        console.error("Could not create a temporary voice channel:", error);

        // nobody ever got in (they left before the move), so nothing would delete it later
        if (channel) {
            ForgetTempChannel(channel.id);
            await channel.delete().catch(() => null);
        }
    }
}

export default {
    name: Events.VoiceStateUpdate,
    once: false,
    async execute(oldState: VoiceState, newState: VoiceState) {
        // muting, deafening and streaming also end up here, only joining, leaving and moving matters
        if (oldState.channelId === newState.channelId) return;

        const guildId = newState.guild.id;
        // the channel people join to get a channel of their own, and the category the channels are made in
        const joinChannelId = await GetServerConfig(guildId, "tempVcMainChannel");
        const categoryId = await GetServerConfig(guildId, "tempvcCategory");
        if (!joinChannelId || !categoryId) return;

        await CleanUpLeftChannel(oldState, joinChannelId, categoryId);

        // this also works when they come from another temporary channel
        if (newState.channelId === joinChannelId && newState.member) {
            await CreateTempChannel(newState, newState.member, categoryId);
        }
    },
};
