import type { Client, VoiceChannel, VoiceState } from "discord.js";
import { ChannelType, Events } from "discord.js";

const TEMP_CHANNEL = "1526740160853577909";
const TEMP_CATEGORY = "1526742944818659378";

export default {
	name: Events.VoiceStateUpdate,
	once: false,
	async execute(old_state: VoiceState, new_state: VoiceState, _client: Client) {
        const guild = new_state.guild;
        const voiceChannel = await guild.channels.fetch(old_state.channelId ? old_state.channelId : new_state.channelId || "", { force: true }) as VoiceChannel | null;

        if (voiceChannel?.type !== ChannelType.GuildVoice) return;

        if (old_state.channel?.parent?.id === TEMP_CATEGORY && old_state.channel.id !== TEMP_CHANNEL) {
            if (!new_state) return;
            
            if (voiceChannel?.members.size === 0){
                old_state.channel.delete().catch(() => null);
            }

            return;
        }

        if (new_state.channelId === TEMP_CHANNEL) {
            new_state.guild.channels.create({
                name: `${new_state.member?.user.username}'s VC`,
                type: ChannelType.GuildVoice,
                parent: TEMP_CATEGORY,
                bitrate: 96000,
                permissionOverwrites: [
                    {
                        id: new_state.member?.id || "",
                        allow: ["ViewChannel", "Connect", "Speak", "MoveMembers"],
                    },
                    {
                        id: new_state.guild.roles.cache.get("1498832228145168514")?.id || "",
                        allow: ["ViewChannel"],
                    }
                ],
            }).then((channel) => {
                new_state.setChannel(channel);
                new_state.channel?.send({
                    content: `Welcome to your temporary voice channel, <@${new_state.member?.id}>!\n\nYou can customize your channel settings using the \`/tempvc options\` command.\n\nTo invite users to your channel, use the \`/tempvc invite\` command.`,
                }).catch(() => null);
            });
        }
	},
};

