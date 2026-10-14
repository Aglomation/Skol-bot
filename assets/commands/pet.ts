import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags, SlashCommandBuilder } from "discord.js";

// the same person can only pet this often, or it can be used to ping someone over and over
const COOLDOWN_MS = 10 * 1000;
const lastPet = new Map<string, number>();

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

	async execute(interaction: ChatInputCommandInteraction) {
		const now = Date.now();
		if (now - (lastPet.get(interaction.user.id) ?? 0) < COOLDOWN_MS) {
			await interaction.reply({ content: "Slow down, you just petted someone!", flags: MessageFlags.Ephemeral });
			return;
		}
		lastPet.set(interaction.user.id, now);

		if (lastPet.size > 500) {
			for (const [userId, time] of lastPet) {
				if (now - time >= COOLDOWN_MS) lastPet.delete(userId);
			}
		}

		await interaction.deferReply();

        const user = interaction.options.getUser("user", true);

        await interaction.editReply({ content: `<@${interaction.user.id}> petted <@${user.id}>[!](${gifs[Math.floor(Math.random() * gifs.length)]})`, allowedMentions: { users: [user.id] } });
	},
};

export default command;
