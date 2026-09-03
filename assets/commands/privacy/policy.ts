import type {
    ChatInputCommandInteraction,
    Client,
    SlashCommandSubcommandBuilder,
} from "discord.js";

import { MessageFlags } from "discord.js";

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
        description:
            "This is the privacy policy for our independent Discord bot. **Please note: This server and bot are entirely student-run and are NOT officially affiliated with, endorsed by, or connected to LBS Kreativa Gymnasiet.** We are committed to protecting your personal information in accordance with EU GDPR and Swedish data protection laws.\n\n" +

            "## Who We Are & Contact\n" +
            "The Data Controller for this bot is the Server Administration Team. If you have questions about your data, or wish to exercise your rights, please open a ticket in our ticket channel, or contact us via email at **me+gdpr@lazyllama.xyz**.\n\n" +

            "## Data Collection & Legal Basis\n" +
            "We collect the absolute minimum data required for server operation:\n" +
            "**- Discord User ID:** Essential to connect your data to your account.\n" +
            "**- Email (Voluntary):** Collected via Google Forms based on your **Consent** to verify your `@lbs.se` address and grant you full access to the server.\n" +
            "**- Birthday (Voluntary):** Collected based on your **Consent** solely for the bot to wish you a happy birthday.\n" +
            "**- Moderation History:** Collected under **Legitimate Interests** (Art. 6(1)(f)) to enforce rules and prevent abuse.\n\n" +

            "## Storage & Third-Party Processors\n" +
            "Your data is securely stored in our own self-hosted PostgreSQL database, which we operate ourselves — no third-party database provider has access to it.\n" +
            "We also use [Google Forms](https://policies.google.com/privacy) as a third-party processor for the initial email verification. We **never** sell your data or share it with unauthorized third parties.\n\n" +

            "## Data Retention\n" +
            "We retain your data only for as long as it is needed:\n" +
            "**- General Data:** Kept as long as you remain in the server (including verified alumni).\n" +
            "**- Birthdays & Emails:** You can withdraw your consent and delete these at any time via bot commands.\n" +
            "**- Moderation History:** Saved permanently if applicable to ensure rule enforcement.\n\n" +

            "## Your Rights & Controls (GDPR)\n" +
            "Under EU and Swedish law, you have full control over your data:\n" +
            "**- `/privacy mydata`:** (Right of Access) Request a copy of all data the bot has saved about you.\n" +
            "**- `/privacy options`:** Customize how your data is handled.\n" +
            "**- `/privacy deleteme`:** (Right to be Forgotten) Wipes your personal data and revokes server access.\n" +
            "You can also delete your data by contacting me+gdpr@lazyllama.xyz from the mail you want to delete.\n\n" +
            "*You have the right to lodge a complaint with the Swedish Authority for Privacy Protection (IMY).*",
        color: 0xEED202,
        footer: {
            text: "Last updated: 2026-07-08",
        },
    };

    await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
    });
};