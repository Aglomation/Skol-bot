import type { ThreadChannel } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors, EmbedBuilder, Events } from "discord.js";
import button from "../assets/buttons/ping.js";
import { GetServerConfig } from "../utils/configManager.js";

export default {
	name: Events.ThreadCreate,
	once: false,
    async execute(thread: ThreadChannel, newlyCreated: boolean) {
        if (!newlyCreated) return;
        if (thread.parentId !== await GetServerConfig(thread.guildId, "supportChannel")) return;

                	const embed = new EmbedBuilder()
                        .setTitle("Welcome to the support thread!")
                        .setDescription(
                "A staff member will be with you shortly, in the meantime please describe your issue and be patient!\n\n" +
                "If you need immediate assistance, please ping the staff by pressing one of the buttons below.\n\n" +
                            "Moderators can't help with verification issues, if you need help with that please ping an administrator or preferably the owner."
                        )
                        .setColor(Colors.Blurple);

        const row = new ActionRowBuilder<ButtonBuilder>();

        // Role - Moderator (a role that isn't set has no button, it would ping nobody)
        const modRoleId = await GetServerConfig(thread.guildId, "modRoleId");
        if (modRoleId) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${button.data.customId}:&${modRoleId}`)
                        .setLabel("Moderator")
                        .setEmoji("🛡️")
                    .setStyle(ButtonStyle.Primary),
            );
        }

                    // Role - Admin
        const adminRoleId = await GetServerConfig(thread.guildId, "adminRoleId");
        if (adminRoleId) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${button.data.customId}:&${adminRoleId}`)
                        .setLabel("Administrator")
                        .setEmoji("🐦")
                    .setStyle(ButtonStyle.Secondary),
            );
        }

                    // User - Me 😋
        row.addComponents(
            new ButtonBuilder()
                        .setCustomId(`${button.data.customId}:${thread.guild.ownerId}`)
                        .setLabel("Owner")
                        .setEmoji("👑")
                .setStyle(ButtonStyle.Danger),
        );

        await thread.send({ embeds: [embed], components: [row] }).catch((error) =>
            console.error("Could not send the support thread message:", error),
        );
    },
};
