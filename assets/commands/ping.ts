import {
	type ChatInputCommandInteraction,
	type Client,
	MessageFlags,
	SlashCommandBuilder,
} from "discord.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("ping")
		.setDescription("Checks the bot latency"),

	async execute(interaction: ChatInputCommandInteraction, client: Client) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const sent = await interaction.fetchReply();

		const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
		const websocket = client.ws.ping;

		await interaction.editReply({
			content: `Pong!\nRoundtrip: \`${roundtrip}ms\`\nWebSocket: \`${websocket}ms\``,
		});
	},
};

export default command;
