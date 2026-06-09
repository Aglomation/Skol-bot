import type { ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder } from "discord.js";
import {
	MessageFlags,
} from "discord.js";

import { UpdateProfile } from "../../../utils/profileManager.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
		.setName("clearverify")
		.setDescription("Removes the email from the selected user")
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("User to clear the email for")
                .setRequired(true),
        );

export default async function command(
	interaction: ChatInputCommandInteraction,
	_client: Client,
) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	if (
		interaction.user.id !== "754965470888722484" &&
		interaction.user.id !== "586643628990922752"
	) {
		await interaction.editReply({
			content: "You are not authorized to use this command.",
		});
		return;
	}
    const user = interaction.options.getUser("user", true);

    await UpdateProfile(user.id, { email: null });
    
    // removes the verify role
    const member = interaction.guild?.members.cache.get(user.id);
    if (member) {
        await member.roles.remove("1498832228145168514");
    }

    await interaction.editReply({
        content: "Verify role cleared for the user.",
    });
}