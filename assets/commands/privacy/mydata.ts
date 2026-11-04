import type {
    ChatInputCommandInteraction,
    SlashCommandSubcommandBuilder,
} from "discord.js";

import { AttachmentBuilder, MessageFlags } from "discord.js";
import { GetSessions } from "../../../features/lfg.js";
import { GetProfile } from "../../../utils/profileManager.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
        .setName("mydata")
        .setDescription("View your saved data");

export default async function command(
    interaction: ChatInputCommandInteraction,
) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const userId = interaction.user.id;
    const guildId = interaction.guild?.id as string;
    const profile = await GetProfile(userId, guildId);

    // the sign-ups for game sessions are not in the database, they are in a file
    const lfgSessions = (await GetSessions(guildId))
        .filter((session) => [session.hostId, ...session.going, ...session.maybe, ...session.waitlist].includes(userId))
        .map((session) => ({
            game: session.game,
            startsAt: session.startsAt,
            status: session.status,
            as: session.hostId === userId ? "host" : session.going.includes(userId) ? "going" : session.maybe.includes(userId) ? "maybe" : "waitlist",
        }));

    if (!profile && lfgSessions.length === 0) {
        await interaction.editReply({
            content: "No data found for your user ID.",
        });
        return;
    }

    // staff notes are not shown to the user.
    const data = {
        ...profile,
        ...(profile
            ? {
                moderation: profile.moderation.map((action) =>
                    action.type === "note"
                        ? { type: action.type, at: action.at, reason: "<hidden>", by: "<hidden>" }
                        : action,
                ),
            }
            : {}),
        lfgSessions,
    };
    const json = JSON.stringify(data, null, 2);

    // discord only allows 2000 characters in a message, the moderation history can be longer than that
    if (json.length > 1800) {
        await interaction.editReply({
            content: "Your raw data is too long for a message, here it is as a file:",
            files: [new AttachmentBuilder(Buffer.from(json), { name: "mydata.json" })],
        });
        return;
    }

    await interaction.editReply({
        content: `Your raw data:\n\`\`\`json\n${json}\n\`\`\``,
    });
}
