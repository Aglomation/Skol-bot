import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";

/**
 * Runs the file of the subcommand that was used, this is all the main.ts of a command folder has to do
 * The file is named after the subcommand and has the handler as its default export
 * Subcommand groups look in a folder named after the group (group/subcommand.ts)
 * @param fileUrl Pass import.meta.url of the main.ts
 */
export async function RunSubcommand(
	fileUrl: string,
	interaction: ChatInputCommandInteraction
): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({
			content: "This command can only be used in a server.",
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	const subcommand = interaction.options.getSubcommand();
	const group = interaction.options.getSubcommandGroup(false);
	const name = group ? `${group} ${subcommand}` : subcommand;

	const folder = path.dirname(fileURLToPath(fileUrl));

	// Use the same extension as the current file (.ts during dev and .js after build)
	const extension = path.extname(fileURLToPath(fileUrl)) || ".ts";
	const subPath = path.join(folder, group ?? "", subcommand + extension);

	try {
		const imported = await import(pathToFileURL(subPath).href);
		const handler = imported?.default;

		if (typeof handler !== "function") {
			await Reply(interaction, `Unknown or invalid subcommand: ${name}`);
			return;
		}

		await handler(interaction);
	} catch (err) {
		console.error(`[Error] Running subcommand ${name}:`, err);
		await Reply(interaction, `Error running subcommand: ${name}`);
	}
}

// the handler might already have deferred, then reply() would throw
async function Reply(interaction: ChatInputCommandInteraction, content: string): Promise<void> {
	if (interaction.replied || interaction.deferred) {
		await interaction.editReply({ content }).catch(() => null);
		return;
	}
	await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => null);
}
