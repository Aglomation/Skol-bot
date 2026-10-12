import type { SlashCommandSubcommandGroupBuilder } from "discord.js";
import { builder as clearVerifyBuilder } from "./verify/clearverify.js";
import { builder as manualVerifyBuilder } from "./verify/manualverify.js";

export const builder = (group: SlashCommandSubcommandGroupBuilder) =>
    group
        .setName("verify")
        .setDescription("Verify commands")
        .addSubcommand(clearVerifyBuilder)
        .addSubcommand(manualVerifyBuilder);