import type { ButtonInteraction, Client, TextChannel } from "discord.js";
import {
	MessageFlags,
    PermissionFlagsBits,
} from "discord.js";

const button: Button = {
	data: {
		customId: "ping",
	},
	async execute(interaction: ButtonInteraction, client: Client) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const userid = interaction.customId.split(":")[1] || "1";

        if (userid === "everyone" || userid === "here") {
            await interaction.editReply({
                content: `You cannot ping @everyone or @here.`,
            });
            return;
        }

        if (userid.startsWith("&")) {
            // Attempt to avoid a @everyone exploit

            const nonNumber = /[^0-9@&<>]/;
            if (userid.match(nonNumber)) {
                await interaction.editReply({
                    content: `Invalid user ID.`,
                });
                return;
            }

            const role = interaction.guild?.roles.cache.get(userid.slice(1));
            const memberCount = role?.members.size ?? Infinity;

            if (memberCount > 30) {
                await interaction.editReply({
                    content: `This role has too many members, please contact an administrator.`,
                });
                return;
            }
        }

        const channel = client.channels.cache.get(interaction.channel?.id as string) as TextChannel;
        if (!client?.user || !channel?.permissionsFor(client.user)?.has(PermissionFlagsBits.SendMessages)) return;

        await channel.send({ content: `<@${interaction.user.id}> has requested your help <@${userid}>` });
        
        interaction.deleteReply();
	},
};

export default button;
