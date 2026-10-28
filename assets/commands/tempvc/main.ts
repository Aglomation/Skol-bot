import type { AutocompleteInteraction, ChatInputCommandInteraction } from "discord.js";
import { InteractionContextType, SlashCommandBuilder } from "discord.js";

import { RunSubcommand } from "../../../utils/subcommands.js";

import { builder as bitrateBuilder } from "./bitrate.js";
import { builder as inviteBuilder } from "./invite.js";
import { builder as kickBuilder } from "./kick.js";
import { builder as limitBuilder } from "./limit.js";
import { builder as nameBuilder } from "./name.js";
import { builder as operatorBuilder } from "./operator.js";
import { ChannelAutocomplete } from "./shared.js";
import { builder as transferBuilder } from "./transfer.js";
import { builder as typeBuilder } from "./type.js";
import { builder as visibilityBuilder } from "./visibility.js";
import { builder as whitelistBuilder } from "./whitelist.js";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("tempvc")
		.setDescription("Manages your temporary voice channel")
		.setContexts(InteractionContextType.Guild)

		.addSubcommand(nameBuilder)
		.addSubcommand(limitBuilder)
		.addSubcommand(bitrateBuilder)
		.addSubcommand(inviteBuilder)
		.addSubcommand(kickBuilder)
		.addSubcommand(whitelistBuilder)
		.addSubcommand(operatorBuilder)
		.addSubcommand(transferBuilder)
		.addSubcommand(visibilityBuilder)
		.addSubcommand(typeBuilder),

	// the channel option is the only one with autocomplete, in every subcommand
    async autocomplete(interaction: AutocompleteInteraction) {
		await ChannelAutocomplete(interaction);
    },

	async execute(interaction: ChatInputCommandInteraction) {
		await RunSubcommand(import.meta.url, interaction);
	},
};

export default command;
