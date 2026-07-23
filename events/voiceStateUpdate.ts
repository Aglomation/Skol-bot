import type { Client, VoiceChannel, VoiceState } from "discord.js";
import { ChannelType, Events } from "discord.js";
import { getDisplayName } from "../utils/memberUtils.js";
import { GetServerConfig } from "../utils/configManager.js";



export default {
	name: Events.VoiceStateUpdate,
	once: false,
	async execute(old_state: VoiceState, new_state: VoiceState, _client: Client) {
        const guild = new_state.guild;
        const voiceChannel = await guild.channels.fetch(old_state.channelId ? old_state.channelId : new_state.channelId || "", { force: true }) as VoiceChannel | null;
        if (voiceChannel?.type !== ChannelType.GuildVoice) return;
        
        const TEMP_CHANNEL = await GetServerConfig(guild.id, "tempVcMainChannel") as string;
        const TEMP_CATEGORY = await GetServerConfig(guild.id, "tempvcCategory") as string;
        const VerifiedRole = await GetServerConfig(guild.id, "verifiedRoleId") as string;

        if (old_state.channel?.parent?.id === TEMP_CATEGORY && old_state.channel.id !== TEMP_CHANNEL) {
            if (!new_state) return;
            
            if (voiceChannel?.members.size === 0){
                old_state.channel.delete().catch(() => null);
            }

            return;
        }

        if (new_state.channelId === TEMP_CHANNEL) {
            new_state.guild.channels.create({
                name: `${getDisplayName(new_state.guild, new_state.member?.id)}'s VC`,
                type: ChannelType.GuildVoice,
                parent: TEMP_CATEGORY,
                bitrate: 96000,
                permissionOverwrites: [
                    {
                        id: new_state.member?.id || "",
                        allow: ["ViewChannel", "Connect", "Speak", "MoveMembers"],
                    },
                    {
                        id: new_state.guild.roles.cache.get(VerifiedRole)?.id || "",
                        allow: ["ViewChannel"],
                    }
                ],
            }).then((channel) => {
                new_state.setChannel(channel);
                channel?.send({
                    content: `Welcome to your temporary voice channel, <@${new_state.member?.id}>!\n\nYou can customize your channel settings using the \`/tempvc options\` command.\n\nTo invite users to your channel, use the \`/tempvc invite\` command.\n\nWhitelist is by default disabled.`,
                }).catch(() => null);
            });
        }
	},
};

