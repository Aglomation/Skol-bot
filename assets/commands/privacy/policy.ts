import type {
    ChatInputCommandInteraction,
    Client,
    SlashCommandSubcommandBuilder,
} from "discord.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
        .setName("policy")
        .setDescription("Review the privacy policy")

export default async function command(
	interaction: ChatInputCommandInteraction,
	_client: Client,
) {
    const embed = {
        title: "Privacy Policy",
        description: "This is the privacy policy for our Discord bot. We take your privacy seriously and are committed to protecting your personal information.",
        fields: [
            {
                name: "Data Collection",
                value: "We collect minimal data necessary for the bot's functionality. This may include your Discord user ID and any information you voluntarily provide through commands.",
            },
            {
                name: "Saved data",
                value: "We save the following data in our database: \n"+
                "- Discord User ID\n"+
                "- Email (if provided)\n"+
                "- Birthday (if provided)\n"+
                "- Privacy Option (your preference for data handling after leaving the server)\n"+
                "- Punishment history (if applicable)\n"+
                "- Any other data you voluntarily provide through commands",
            },
            {
                name: "Data Retention",
                value: "We retain your data only as long as necessary for the bot's operation. You can request data deletion at any time.",
            },
        ],
        color: 0xEED202,
        footer: {
            text: "Last updated: 2026-07-05",
        },
    };

    await interaction.reply({
        embeds: [embed],
        ephemeral: true,
    });
};