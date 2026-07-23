import type { Client, ThreadChannel } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors, EmbedBuilder, Events } from "discord.js";
import button from "../assets/buttons/ping.js";
import { GetServerConfig } from "../utils/configManager.js";

export default {
	name: Events.ThreadCreate,
	once: false,
    async execute ( thread: ThreadChannel, newlyCreated: boolean, _client: Client) {
        if (thread.parentId === (await GetServerConfig(thread.guildId, "supportChannel")) as string) {
            if (newlyCreated) {
                	const embed = new EmbedBuilder()
                        .setTitle("Welcome to the support thread!")
                        .setDescription(
                            "A staff member will be with you shortly, in the meantime please describe your issue and be patient!\n\n"+
                            "If you need immediate assistance, please ping the staff by pressing one of the buttons below.\n\n"+
                            "Moderators can't help with verification issues, if you need help with that please ping an administrator or preferably the owner."
                        )
                        .setColor(Colors.Blurple);

                    // Role - Moderator
                    const btn1 = new ButtonBuilder()
                        .setCustomId(`${button.data.customId}:&${await GetServerConfig(thread.guildId, "modRoleId") as string}`)
                        .setLabel("Moderator")
                        .setEmoji("🛡️")
                        .setStyle(ButtonStyle.Primary);

                    // Role - Admin
                    const btn2 = new ButtonBuilder()
                        .setCustomId(`${button.data.customId}:&${await GetServerConfig(thread.guildId, "adminRoleId") as string}`)
                        .setLabel("Administrator")
                        .setEmoji("🐦")
                        .setStyle(ButtonStyle.Secondary);

                    // User - Me 😋
                    const btn3 = new ButtonBuilder()
                        .setCustomId(`${button.data.customId}:${thread.guild.ownerId}`)
                        .setLabel("Owner")
                        .setEmoji("👑")
                        .setStyle(ButtonStyle.Danger);

                    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(btn1, btn2, btn3);

                    await thread.send({ embeds: [embed], components: [row] });
            }
        }
    }
};
