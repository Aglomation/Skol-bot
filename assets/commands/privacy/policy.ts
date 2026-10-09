import type {
    ChatInputCommandInteraction,
    Client,
    SlashCommandSubcommandBuilder,
} from "discord.js";
import { MessageFlags } from "discord.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
        .setName("policy")
        .setDescription("Läs vår integritetspolicy / Review the privacy policy")
        .setDescriptionLocalization("en-US", "Read our privacy policy / Läs vår integritetspolicy")
        .setDescriptionLocalization("sv-SE", "Läs vår integritetspolicy / Review the privacy policy")
        
        .addStringOption((option) =>
            option
                .setName("language")
                .setDescriptionLocalization("en-US", "Choose language (Default: Svenska)")
                .setDescriptionLocalization("sv-SE", "Välj språk (Standard: Svenska)")
                .setRequired(false)
                .addChoices(
                    { name: "Svenska", value: "sv" },
                    { name: "English", value: "en" }
                )
        );

export default async function command(
    interaction: ChatInputCommandInteraction,
    _client: Client,
) {
    const language = interaction.options.getString("language") || "sv";

    const svEmbed = {
        title: "Integritetspolicy (Privacy Policy)",
        description:
            "Detta är integritetspolicyn för vår oberoende Discord-bot. **Observera: Denna server och bot drivs helt av elever och är INTE officiellt anslutna till, sponsrade av eller kopplade till LBS Kreativa Gymnasiet.** Vi har åtagit oss att skydda dina personuppgifter i enlighet med EU:s dataskyddsförordning (GDPR) och svensk dataskyddslagstiftning.\n\n" +

            "## Vilka vi är & Kontakt\n" +
            "Personuppgiftsansvarig för denna bot är serverns administrationsgrupp. Om du har frågor om dina uppgifter eller vill utöva dina rättigheter, vänligen skapa ett ärende i vår ärendekanal eller kontakta oss via e-post på `me+gdpr@lazyllama.xyz`.\n\n" +

            "## Datainsamling & Rättslig Grund\n" +
            "Vi samlar in det absoluta minimum av uppgifter som krävs för serverns drift:\n" +
            "**- Discord Användar-ID:** Nödvändigt för att koppla dina uppgifter till ditt konto.\n" +
            "**- E-postadress (Krävs för fullständig åtkomst):** Samlas in via Google Formulär för att verifiera din `@lbs.se`-adress och ge dig tillgång till servern. Detta är nödvändigt för att upprätthålla en säker, exklusiv miljö för elever (**Berättigat intresse**).\n" +
            "**- Födelsedatum (Frivilligt):** Samlas in baserat på ditt **samtycke** uteslutande för att boten ska kunna gratulera dig på din födelsedag.\n" +
            "**- Modereringshistorik:** Samlas in med stöd av **berättigat intresse** (Art. 6.1 f GDPR) för att upprätthålla regler och förhindra missbruk.\n\n" +

            "## Lagring & Personuppgiftsbiträden\n" +
            "Dina uppgifter lagras säkert i vår egen driftade PostgreSQL-databas, som vi hanterar själva — ingen tredjepartsleverantör av databaser har tillgång till den.\n" +
            "Vi använder även [Google Formulär](https://policies.google.com/privacy) som ett personuppgiftsbiträde för den initiala e-postverifieringen. Vi säljer **aldrig** dina uppgifter eller delar dem med obehöriga tredje parter.\n\n" +

            "## Lagringstid\n" +
            "Vi behåller dina uppgifter endast så länge det är nödvändigt:\n" +
            "**- Allmänna uppgifter:** Bevaras så länge du är kvar på servern (inklusive verifierade alumner).\n" +
            "**- Födelsedatum & E-postadresser:** Du kan när som helst återkalla ditt samtycke och radera dessa via botkommandon.\n" +
            "**- Modereringshistorik:** Bevaras så länge det är nödvändigt för att upprätthålla serverns regler och förhindra att avstängningar kringgås.\n\n" +

            "## Dina Rättigheter & Kontroll (GDPR)\n" +
            "Enligt EU:s och Sveriges lagstiftning har du full kontroll över dina uppgifter:\n" +
            "**- `/privacy mydata`:** (Rätt till tillgång) Begär en kopia av alla uppgifter boten har sparat om dig.\n" +
            "**- `/privacy options`:** Anpassa hur dina uppgifter hanteras.\n" +
            "**- `/privacy deleteme`:** (Rätt att bli bortglömd) Raderar dina personuppgifter och återkallar din tillgång till servern.\n" +
            "Du kan också begära radering av dina uppgifter genom att kontakta oss på `me+gdpr@lazyllama.xyz` från den e-postadress du vill radera.\n\n" +
            "*Du har rätt att lämna in ett klagomål gällande vår personuppgiftshantering till Integritetsskyddsmyndigheten (IMY).*",
        color: 0xEED202,
        footer: {
            text: "Senast uppdaterad: 2026-10-08",
        },
    };

    const enEmbed = {
        title: "Privacy Policy",
        description:
            "This is the privacy policy for our independent Discord bot. **Please note: This server and bot are entirely student-run and are NOT officially affiliated with, endorsed by, or connected to LBS Kreativa Gymnasiet.** We are committed to protecting your personal information in accordance with EU GDPR and Swedish data protection laws.\n\n" +

            "## Who We Are & Contact\n" +
            "The Data Controller for this bot is the Server Administration Team. If you have questions about your data, or wish to exercise your rights, please open a ticket in our ticket channel, or contact us via email at `me+gdpr@lazyllama.xyz`.\n\n" +

            "## Data Collection & Legal Basis\n" +
            "We collect the absolute minimum data required for server operation:\n" +
            "**- Discord User ID:** Essential to connect your data to your account.\n" +
            "**- Email (Required for Full Access):** Collected via Google Forms to verify your `@lbs.se` address and grant you access to the server. This is necessary to maintain a secure, student-only environment (**Legitimate Interests**).\n" +
            "**- Birthday (Voluntary):** Collected based on your **Consent** solely for the bot to wish you a happy birthday.\n" +
            "**- Moderation History:** Collected under **Legitimate Interests** (Art. 6(1)(f)) to enforce rules and prevent abuse.\n\n" +

            "## Storage & Third-Party Processors\n" +
            "Your data is securely stored in our own self-hosted PostgreSQL database, which we operate ourselves — no third-party database provider has access to it.\n" +
            "We also use [Google Forms](https://policies.google.com/privacy) as a third-party processor for the initial email verification. We **never** sell your data or share it with unauthorized third parties.\n\n" +

            "## Data Retention\n" +
            "We retain your data only for as long as it is needed:\n" +
            "**- General Data:** Kept as long as you remain in the server (including verified alumni).\n" +
            "**- Birthdays & Emails:** You can withdraw your consent and delete these at any time via bot commands.\n" +
            "**- Moderation History:** Retained as long as necessary to enforce server rules and prevent ban evasion.\n\n" +

            "## Your Rights & Controls (GDPR)\n" +
            "Under EU and Swedish law, you have full control over your data:\n" +
            "**- `/privacy mydata`:** (Right of Access) Request a copy of all data the bot has saved about you.\n" +
            "**- `/privacy options`:** Customize how your data is handled.\n" +
            "**- `/privacy deleteme`:** (Right to be Forgotten) Wipes your personal data and revokes server access.\n" +
            "You can also delete your data by contacting us at `me+gdpr@lazyllama.xyz` from the email you want to delete.\n\n" +
            "*You have the right to lodge a complaint with the Swedish Authority for Privacy Protection (IMY).*",
        color: 0xEED202,
        footer: {
            text: "Last updated: 2026-10-08",
        },
    };

    const selectedEmbed = language === "en" ? enEmbed : svEmbed;

    await interaction.reply({
        embeds: [selectedEmbed],
        flags: MessageFlags.Ephemeral,
    });
}