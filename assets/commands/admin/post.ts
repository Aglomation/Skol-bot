import type { SlashCommandSubcommandGroupBuilder } from "discord.js";
import { builder as rulesBuilder } from "./post/rules.js";
import { builder as ticketBuilder } from "./post/ticket.js";
import { builder as verifyBuilder } from "./post/verify.js";

export const builder = (group: SlashCommandSubcommandGroupBuilder) =>
    group
        .setName("post")
        .setDescription("Post management commands")
        .addSubcommand(rulesBuilder)
        .addSubcommand(verifyBuilder)
        .addSubcommand(ticketBuilder);