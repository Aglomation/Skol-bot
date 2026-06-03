import type { Client, ThreadChannel } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors, EmbedBuilder, Events } from "discord.js";
import button from "../assets/buttons/ping.js";

export default {
	name: Events.ThreadCreate,
	once: false,
    async execute ( thread: ThreadChannel, newlyCreated: boolean, client: Client) {
        if (client.user?.id !== "1410803606180986911") return;
        if (thread.parentId === "1499885683995840683"){
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
                        .setCustomId(`${button.data.customId}:&1500449453390299257`)
                        .setLabel("Moderator")
                        .setEmoji("🛡️")
                        .setStyle(ButtonStyle.Primary);

                    // Role - Admin
                    const btn2 = new ButtonBuilder()
                        .setCustomId(`${button.data.customId}:&1498830417191637034`)
                        .setLabel("Administrator")
                        .setEmoji("🐦")
                        .setStyle(ButtonStyle.Secondary);

                    // User - Me 😋
                    const btn3 = new ButtonBuilder()
                        .setCustomId(`${button.data.customId}:586643628990922752`)
                        .setLabel("Owner")
                        .setEmoji("👑")
                        .setStyle(ButtonStyle.Danger);

                    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(btn1, btn2, btn3);

                    await thread.send({ embeds: [embed], components: [row] });
            }
        }
    }
};
