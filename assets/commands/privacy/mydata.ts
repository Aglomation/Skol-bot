import type {
    ChatInputCommandInteraction,
    SlashCommandSubcommandBuilder,
} from "discord.js";

import { AttachmentBuilder, MessageFlags } from "discord.js";
import { GetGiveawaysEnteredBy, GetGiveawaysWonBy } from "../../../features/giveaway.js";
import { GetSessions } from "../../../features/lfg.js";
import { GetProfile } from "../../../utils/profileManager.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
        .setName("mydata")
        .setDescription("View your saved data");

// discord only allows 2000 characters in a message, so longer data is sent as a file
const MAX_INLINE_LENGTH = 1800;

/** How the person is in a game session */
function RoleInSession(session: { hostId: string; going: string[]; maybe: string[] }, userId: string): string {
    if (session.hostId === userId) return "host";
    if (session.going.includes(userId)) return "going";
    if (session.maybe.includes(userId)) return "maybe";
    return "waitlist";
}

/** The profile as the person gets to see it, the notes of the staff are hidden */
function HideStaffNotes(profile: UserProfile) {
    return {
        ...profile,
        moderation: profile.moderation.map((action) =>
            action.type === "note" ? { type: action.type, at: action.at, reason: "<hidden>", by: "<hidden>" } : action,
        ),
    };
}

/**
 * Everything the bot has saved about a person: the profile in the database, and what is in the files (game sessions, giveaways)
 * @returns null if there is nothing
 */
async function CollectMemberData(guildId: string, userId: string) {
    const profile = await GetProfile(userId, guildId);

    // the sign-ups for game sessions are not in the database, they are in a file
    const lfgSessions = (await GetSessions(guildId))
        .filter((session) => [session.hostId, ...session.going, ...session.maybe, ...session.waitlist].includes(userId))
        .map((session) => ({
            game: session.game,
            startsAt: session.startsAt,
            status: session.status,
            as: RoleInSession(session, userId),
        }));

    // giveaways that were won are kept in a file for 7 days after they ended
    const giveawaysWon = (await GetGiveawaysWonBy(guildId, userId)).map((giveaway) => ({
        prize: giveaway.prize,
        endedAt: giveaway.endedAt,
    }));

    // giveaways that were entered (the ids are kept in a file until 7 days after they ended)
    const giveawaysEntered = (await GetGiveawaysEnteredBy(guildId, userId)).map((giveaway) => ({
        prize: giveaway.prize,
        endsAt: giveaway.endsAt,
    }));

    if (!profile && lfgSessions.length === 0 && giveawaysWon.length === 0 && giveawaysEntered.length === 0) return null;

    return {
        ...(profile ? HideStaffNotes(profile) : {}),
        lfgSessions,
        giveawaysWon,
        giveawaysEntered,
    };
}

export default async function command(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const data = await CollectMemberData(interaction.guild?.id as string, interaction.user.id);
    if (!data) {
        await interaction.editReply({ content: "No data found for your user ID." });
        return;
    }

    const json = JSON.stringify(data, null, 2);
    if (json.length > MAX_INLINE_LENGTH) {
        await interaction.editReply({
            content: "Your raw data is too long for a message, here it is as a file:",
            files: [new AttachmentBuilder(Buffer.from(json), { name: "mydata.json" })],
        });
        return;
    }

    await interaction.editReply({ content: `Your raw data:\n\`\`\`json\n${json}\n\`\`\`` });
}
