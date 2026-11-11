import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { ExtendGiveaway, FindGiveaway, IsActive } from "../../../features/giveaway.js";
import { ParseDuration } from "../../../utils/duration.js";
import { SendLog } from "../../../utils/logChannel.js";
import { HasPermission } from "../../../utils/permissions.js";


export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("extend")
		.setDescription("Extend a giveaway's duration")
		.addStringOption((option) =>
			option.setName("giveaway").setDescription("The giveaway to extend").setAutocomplete(true).setRequired(true),
		)
		.addStringOption((option) =>
			option.setName("duration").setDescription("The duration to add").setRequired(true),
		);

export default async function command(interaction: ChatInputCommandInteraction) {
	if (!interaction.guild) return;
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const durationMs = ParseDuration(interaction.options.getString("duration", true));
    if (durationMs === null || durationMs < 1000) {
        await interaction.editReply("The duration has to be atleast 1 second, like `30m`, `2h` or `1d`.");
        return;
    }
	const giveaway = await FindGiveaway(interaction.guild.id, interaction.options.getString("giveaway", true));
	if (!giveaway || !IsActive(giveaway)) {
		await interaction.editReply("I can't find a running giveaway like that, pick one from the list.");
		return;
	}

    if (interaction.user.id !== giveaway.ownerId && !(await HasPermission(interaction, PermissionFlagsBits.Administrator))) {
		await interaction.editReply("You can't extend a giveaway you didn't start.");
		return;
	}

	await ExtendGiveaway(interaction.client, giveaway, durationMs);
	await interaction.editReply("The giveaway was extended.");
	await SendLog(interaction.client, interaction.guild.id, `${interaction.user.tag} extended the giveaway for **${giveaway.prize}** by ${durationMs}ms.`);
}
