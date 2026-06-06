import type { ButtonInteraction, Client, TextChannel } from "discord.js";
import {
	MessageFlags,
} from "discord.js";

const button: Button = {
	data: {
		customId: "ping",
	},
	async execute(interaction: ButtonInteraction, client: Client) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const userid = interaction.customId.split(":")[1] || "1";
        if (userid.startsWith("&")) {
            if (interaction.guild?.roles.cache.get(userid.slice(1))?.members.size || Infinity > 30) {
                await interaction.editReply({
                    content: `This role has too many members, please contact an administrator.`,
                });
                return;
            }
        }

        const channel = await client.channels.fetch(interaction.channel?.id || "") as TextChannel;
        if (!channel) return;
        
        // Hopefully this wont be used for an @everyone exploit :P
        await channel.send(`User has requested your help <@${userid}>`);
        interaction.deleteReply();
	},
};

export default button;
