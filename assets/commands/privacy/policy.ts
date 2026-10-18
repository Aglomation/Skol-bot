import type {
    ChatInputCommandInteraction,
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
                .setDescription("Choose language (Default: Svenska)")
                .setDescriptionLocalization("en-US", "Choose language (Default: Svenska)")
                .setDescriptionLocalization("sv-SE", "Välj språk (Standard: Svenska)")
                .setRequired(false)
                .addChoices(
                    { name: "Svenska", value: "sv" },
                    { name: "English", value: "en" }
                )
        );

export default async function command(
    interaction: ChatInputCommandInteraction
) {
    const language = interaction.options.getString("language") || "sv";

    const svEmbed = {
        title: "Integritetspolicy (Privacy Policy)",
        description:
            "Detta är integritetspolicyn för vår oberoende Discord-bot. **Observera: Denna server och bot drivs helt av elever och är INTE officiellt anslutna till, sponsrade av eller kopplade till LBS Kreativa Gymnasiet eller AcadeMedia.** Vi har åtagit oss att skydda dina personuppgifter i enlighet med EU:s dataskyddsförordning (GDPR) och svensk dataskyddslagstiftning.\n\n" +
            "## Vilka vi är & Kontakt\n" +
            "Personuppgiftsansvarig för denna bot är serverns administrationsgrupp. Om du har frågor om dina uppgifter eller vill utöva dina rättigheter, vänligen skapa ett ärende i vår ärendekanal eller kontakta oss via e-post på `me+gdpr@lazyllama.xyz`.\n\n" +
            "## Vad vi sparar & Rättslig grund\n" +
            "**- Discord Användar-ID:** Nödvändigt för att koppla dina uppgifter till ditt konto.\n" +
            "**- E-postadress (krävs för fullständig åtkomst):** Samlas in via Google Formulär med en verifieringskod som kopplar formuläret till ditt Discord-konto, för att verifiera din `@lbs.se`-adress och hålla servern till för elever (**Berättigat intresse**). Varje e-postadress kan bara kopplas till ett konto.\n" +
            "**- Födelsedatum (frivilligt):** Sparas med år baserat på ditt **samtycke**. **Observera:** alla på servern kan se ditt födelsedatum och din ålder via `/birthday`, och boten gratulerar dig offentligt, med ålder, i födelsedagskanalen.\n" +
            "**- Modereringshistorik:** Varningar, anteckningar, avstängningar och bannlysningar med orsak, tid och ansvarig moderator (**Berättigat intresse**, Art. 6.1 f GDPR). Loggas även i en intern moderatorkanal.\n" +
            "**- Direktmeddelanden till boten:** Vidarebefordras med innehåll och ditt ID till en privat moderatorkanal (**Berättigat intresse**: support och missbruk).\n" +
            "Boten sparar annars inte dina meddelanden. Dina val i verifieringen (stad, klass, år, pronomen) blir roller som alla ser och hålls bara i botens minne, högst en vecka, medan du verifierar dig.\n\n" +
            "## Lagring & Personuppgiftsbiträden\n" +
            "Uppgifterna lagras i vår självhostade PostgreSQL-databas, ingen tredjepart har tillgång till den. Meddelanden och roller lagras av Discord ([integritetspolicy](https://discord.com/privacy)). Vi använder även [Google Formulär](https://policies.google.com/privacy) för e-postverifieringen. Vi säljer **aldrig** dina uppgifter eller delar dem med obehöriga tredje parter.\n\n" +
            "## Lagringstid\n" +
            "**- Discord-ID, e-post och verifieringskod:** Bevaras så länge du är kvar. När du lämnar gäller ditt val i `/privacy options`: standardvalet raderar bara födelsedatumet och behåller e-post och kod, så du slipper verifiera dig igen om du kommer tillbaka. Välj att radera allt för att ta bort även dem.\n" +
            "**- Födelsedatum:** Tills du tar bort det (`/birthday clear`), lämnar servern (om du inte valt att behålla allt) eller raderar dina uppgifter.\n" +
            "**- Modereringshistorik:** Bevaras så länge det behövs för reglerna och för att hindra att avstängningar kringgås. Den raderas **inte** av `/privacy deleteme` eller av att välja radera allt, kontakta oss om du vill att den ses över.\n" +
            "**- Loggkanaler:** Meddelanden i de interna kanalerna finns kvar i Discord tills en moderator raderar dem.\n\n" +
            "## Dina Rättigheter & Kontroll (GDPR)\n" +
            "**- `/privacy mydata`:** (Rätt till tillgång) En kopia av uppgifterna i botens databas.\n" +
            "**- `/privacy options`:** Välj vad som händer med dina uppgifter när du lämnar servern.\n" +
            "**- `/privacy deleteme`:** (Rätt att bli bortglömd) Tar bort din verifierade roll och raderar e-post, verifieringskod och födelsedatum (hela profilen om du saknar modereringshistorik). Du måste verifiera dig igen för åtkomst.\n" +
            "**- `/birthday clear`:** Tar bort ditt födelsedatum.\n" +
            "Du kan också begära radering genom att kontakta oss på `me+gdpr@lazyllama.xyz` från den e-postadress du vill radera.\n\n" +
            "*Du har rätt att lämna in ett klagomål gällande vår personuppgiftshantering till Integritetsskyddsmyndigheten (IMY).*",
        color: 0xEED202,
        footer: {
            text: "Senast uppdaterad: 2026-10-12",
        },
    };

    const enEmbed = {
        title: "Privacy Policy",
        description:
            "This is the privacy policy for our independent Discord bot. **Please note: This server and bot are entirely student-run and are NOT officially affiliated with, endorsed by, or connected to LBS Kreativa Gymnasiet.** We are committed to protecting your personal information in accordance with EU GDPR and Swedish data protection laws.\n\n" +
            "## Who We Are & Contact\n" +
            "The Data Controller for this bot is the Server Administration Team. If you have questions about your data, or wish to exercise your rights, please open a ticket in our ticket channel, or contact us via email at `me+gdpr@lazyllama.xyz`.\n\n" +
            "## What We Store & Legal Basis\n" +
            "**- Discord User ID:** Essential to connect your data to your account.\n" +
            "**- Email (required for full access):** Collected via Google Forms with a verification code that links the form to your Discord account, to verify your `@lbs.se` address and keep the server student-only (**Legitimate Interests**). Each email can only be linked to one account.\n" +
            "**- Birthday (voluntary):** Stored with the year, based on your **Consent**. **Note:** everyone on the server can see your birth date and age through `/birthday`, and the bot congratulates you publicly, with your age, in the birthday channel.\n" +
            "**- Moderation History:** Warnings, notes, mutes and bans with the reason, time and responsible moderator (**Legitimate Interests**, Art. 6(1)(f)). Also logged in an internal moderator channel.\n" +
            "**- Direct messages to the bot:** Forwarded with their content and your ID to a private moderator channel (**Legitimate Interests**: support and abuse).\n" +
            "Otherwise the bot does not store your messages. Your choices during verification (city, class, year, pronouns) become roles everyone can see and are only kept in the bot's memory, for up to a week, while you verify.\n\n" +
            "## Storage & Third-Party Processors\n" +
            "The data is stored in our own self-hosted PostgreSQL database, no third party has access to it. Messages and roles are stored by Discord ([privacy policy](https://discord.com/privacy)). We also use [Google Forms](https://policies.google.com/privacy) for the email verification. We **never** sell your data or share it with unauthorized third parties.\n\n" +
            "## Data Retention\n" +
            "**- Discord ID, email and verification code:** Kept as long as you remain in the server. When you leave, your choice in `/privacy options` applies: the default only deletes your birthday and keeps the email and code, so you don't have to verify again if you return. Choose to delete everything to remove those too.\n" +
            "**- Birthday:** Until you remove it (`/birthday clear`), leave the server (unless you chose to keep everything) or delete your data.\n" +
            "**- Moderation History:** Kept as long as necessary to enforce the rules and prevent ban evasion. It is **not** deleted by `/privacy deleteme` or by choosing to delete everything, contact us if you want it reviewed.\n" +
            "**- Log channels:** Messages in the internal channels stay in Discord until a moderator deletes them.\n\n" +
            "## Your Rights & Controls (GDPR)\n" +
            "**- `/privacy mydata`:** (Right of Access) A copy of the data in the bot's database.\n" +
            "**- `/privacy options`:** Choose what happens to your data when you leave the server.\n" +
            "**- `/privacy deleteme`:** (Right to be Forgotten) Removes your verified role and deletes your email, verification code and birthday (the whole profile if you have no moderation history). You have to verify again to regain access.\n" +
            "**- `/birthday clear`:** Removes your birthday.\n" +
            "You can also request deletion by contacting us at `me+gdpr@lazyllama.xyz` from the email you want to delete.\n\n" +
            "*You have the right to lodge a complaint with the Swedish Authority for Privacy Protection (IMY).*",
        color: 0xEED202,
        footer: {
            text: "Last updated: 2026-10-12",
        },
    };

    const selectedEmbed = language === "en" ? enEmbed : svEmbed;

    await interaction.reply({
        embeds: [selectedEmbed],
        flags: MessageFlags.Ephemeral,
    });
}