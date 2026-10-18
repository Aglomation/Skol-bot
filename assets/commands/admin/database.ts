import type { ButtonInteraction, ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } from "discord.js";
import { db } from "../../../db/client.js";
import * as schema from "../../../db/schema.js";
import { IsBotOwner } from "../../../utils/botOwner.js";
import type { SchemaCheck } from "../../../utils/schemaSync.js";
import { ApplyStatements, CheckSchema } from "../../../utils/schemaSync.js";

export const builder = (subcommand: SlashCommandSubcommandBuilder) =>
	subcommand
		.setName("database")
		.setDescription("Check if the database matches the bot, and update it (bot owner only)")
		.addStringOption((option) =>
			option
				.setName("action")
				.setDescription("What to do")
				.setRequired(true)
				.addChoices(
					{ name: "Status - show what is different", value: "status" },
					{ name: "Apply - add what is missing (safe)", value: "apply" },
					{ name: "Apply everything - can remove data, asks first", value: "apply-all" },
				),
		);

// a discord message is 2000 characters at most
function Describe(check: Extract<SchemaCheck, { state: "pending" }>): string {
	const lines = check.statements.map((statement) => `${check.risky.includes(statement) ? "⚠️" : "✅"} ${statement}`);
	let text = lines.join("\n");
	if (text.length > 1300) text = `${text.slice(0, 1300)}\n... (${lines.length} changes in total)`;

	const warnings = check.warnings.length > 0 ? `\n**Warnings:**\n${check.warnings.join("\n").slice(0, 400)}` : "";
	return `\`\`\`sql\n${text}\n\`\`\`${warnings}`;
}

export default async function command(interaction: ChatInputCommandInteraction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	// this changes the database, so Administrator is not enough
	if (!(await IsBotOwner(interaction.client, interaction.user.id))) {
		await interaction.editReply("Only the owner of the bot can use this.");
		return;
	}

	const action = interaction.options.getString("action", true);
	const check = await CheckSchema(db, schema);

	if (check.state === "unavailable") {
		await interaction.editReply(`⚠️ ${check.reason}`);
		return;
	}
	if (check.state === "up-to-date") {
		await interaction.editReply("✅ The database matches the schema, nothing to do.");
		return;
	}

	if (action === "status") {
		await interaction.editReply(
			`${check.safeToApply ? "These only add things, **Apply** is safe:" : "Some of these could remove or change data (⚠️), **Apply** won't do them:"}\n${Describe(check)}`,
		);
		return;
	}

	if (action === "apply" && !check.safeToApply) {
		await interaction.editReply(`Some changes could remove or change data, so nothing was done. Look at them, and use **Apply everything** if you want them:\n${Describe(check)}`);
		return;
	}

	if (action === "apply-all" && !check.safeToApply) {
		// removing data can't be undone, so it has to be confirmed after seeing exactly what runs
		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setCustomId("admin_database_confirm").setLabel("Run these changes").setStyle(ButtonStyle.Danger),
			new ButtonBuilder().setCustomId("admin_database_cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary),
		);
		const message = await interaction.editReply({
			content: `⚠️ This can remove or change data and can't be undone:\n${Describe(check)}`,
			components: [row],
		});

		let pressed: ButtonInteraction;
		try {
			pressed = await message.awaitMessageComponent({
				componentType: ComponentType.Button,
				time: 60000,
				filter: (i) => i.user.id === interaction.user.id,
			});
		} catch {
			await interaction.editReply({ content: "Timed out, nothing was changed.", components: [] });
			return;
		}

		if (pressed.customId !== "admin_database_confirm") {
			await pressed.update({ content: "Canceled, nothing was changed.", components: [] });
			return;
		}
		await pressed.update({ content: "Running...", components: [] });
	}

	try {
		await ApplyStatements(db, check.statements);
		console.log(`[Database] ${interaction.user.id} applied ${check.statements.length} change(s) with /admin database:\n${check.statements.join("\n")}`);
		await interaction.editReply({ content: `✅ Done, ${check.statements.length} change(s) applied.`, components: [] });
	} catch (error) {
		console.error("[Database] /admin database failed:", error);
		await interaction.editReply({
			content: `⚠️ It failed and was rolled back, nothing was changed.\n\`${error instanceof Error ? error.message : String(error)}\``,
			components: [],
		});
	}
}
