import type { ChatInputCommandInteraction, Client } from "discord.js";
import { SlashCommandBuilder } from "discord.js";

const gifs = [
    "https://klipy.com/gifs/lily-yami-healer-toshite-tanoshiku-ikiru",
    "https://klipy.com/gifs/anime-good-girl-1",
    "https://klipy.com/gifs/cat-girl-head-pat",
    "https://klipy.com/gifs/kobayashi-dragon-10",
];


const command: Command = {
	data: new SlashCommandBuilder()
		.setName("pet")
		.setDescription("Pet another user")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("The user to pet")
                .setRequired(true)
        ),

	async execute(interaction: ChatInputCommandInteraction, _client: Client) {
		await interaction.deferReply();

        const user = interaction.options.getUser("user", true);

        await interaction.editReply({ content: `<@${interaction.user.id}> petted <@${user.id}>[!](${gifs[Math.floor(Math.random() * gifs.length)]})`, allowedMentions: { users: [user.id] } });
	},
};

export default command;
