import type { ChatInputCommandInteraction, Client, SlashCommandSubcommandBuilder } from "discord.js";
import {
	MessageFlags,
} from "discord.js";

import { FindByValue, UpdateProfile } from "../../../utils/profileManager.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
    subcommand
		.setName("manualverify")
		.setDescription("Manually verifies a user by setting their email and giving them the verify role")
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("User to manually verify")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName("email")
                .setDescription("Email to set for the user")
                .setRequired(true),
        )
        .addBooleanOption((option) =>
            option
                .setName("force")
                .setDescription("Force verification, clears email from existing user if it's already in use elsewhere.")
                .setRequired(false),
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
    const email = interaction.options.getString("email", true);
    const force = interaction.options.getBoolean("force") ?? false;

    if (await FindByValue("email", email)) {
        if (!force) {
            await interaction.editReply({
                content: "This email is already associated with another account. Use the force option to override.",
            });
            return;
        }

        const existingProfile = await FindByValue("email", email);
        if (existingProfile) {
            await UpdateProfile(existingProfile.id, { email: null });
        }
    }

    await UpdateProfile(user.id, { email });

    // gives the verify role
    const member = interaction.guild?.members.cache.get(user.id);
    if (member) {
        await member.roles.add("1498832228145168514");
    }

    await interaction.editReply({
        content: "User manually verified.",
    });
}