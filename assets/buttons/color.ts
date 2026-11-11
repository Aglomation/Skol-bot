import type { ButtonInteraction, GuildMember } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from "discord.js";
import {
	BuildColorDone,
	BuildColorPicker,
	COLOR_BUTTON_ID,
	GetColorRoles,
	GetCurrentColor,
	HexText,
	ParseChoice,
	SetColor,
} from "../../features/colorRoles.js";
import { IsVerified } from "../../utils/permissions.js";

// discord's limits for one message
const MAX_EMBEDS_PER_MESSAGE = 10;
const BUTTONS_PER_ROW = 5;

type ColorRoles = NonNullable<ReturnType<typeof GetColorRoles>>;

const NO_COLOR_ROLES_TEXT = "Det finns inga färgroller på servern längre.";
const COLOR_GONE_TEXT = "Den färgen finns inte längre, välj en annan.";

// what the person is told when SetColor didn't work
const SET_COLOR_ERRORS = {
	gone: COLOR_GONE_TEXT,
	"missing-permission": "Jag kan inte ge dig den rollen, min roll måste ligga över färgrollerna. Be en administratör.",
	failed: "Något gick fel, försök igen.",
};

function InChunks<T>(items: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let start = 0; start < items.length; start += size) chunks.push(items.slice(start, start + size));
	return chunks;
}

/**
 * The messages of the preview: the colors in groups of 10 (the most embeds in a message), each with a button to pick it, and a last message to remove the color
 * The embeds show the color as the bar on their left side, that is what the person looks at
 */
function BuildPreviewMessages(colors: ColorRoles) {
	const colorMessages = InChunks(colors.options, MAX_EMBEDS_PER_MESSAGE).map((group) => ({
		embeds: group.map((color) =>
			new EmbedBuilder()
				// pure white is shown as a different color by discord
				.setColor(color.hex === 0xffffff ? 0xfffffe : color.hex)
				.setDescription(`⬅️ — ${color.label} \`${HexText(color.hex)}\``),
		),
		components: InChunks(
			group.map((color) =>
				new ButtonBuilder().setCustomId(`${COLOR_BUTTON_ID}:apply:${color.roleId}`).setLabel(color.label).setStyle(ButtonStyle.Secondary),
			),
			BUTTONS_PER_ROW,
		).map((buttons) => new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)),
	}));

	const removeMessage = {
		embeds: [new EmbedBuilder().setDescription("❌ — Ta bort färg")],
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setCustomId(`${COLOR_BUTTON_ID}:apply:none`).setLabel("Ta bort färg").setStyle(ButtonStyle.Danger),
			),
		],
	};

	return [...colorMessages, removeMessage];
}

async function ShowPreview(interaction: ButtonInteraction, colors: ColorRoles | null) {
	if (!colors) {
		await interaction.reply({ content: NO_COLOR_ROLES_TEXT, embeds: [], components: [], flags: MessageFlags.Ephemeral });
		return;
	}

	await interaction.reply({
		content: "Skickar alla färger, vänligen kolla på stapeln till vänster om embeden.",
		embeds: [],
		components: [],
		flags: MessageFlags.Ephemeral,
	});

	for (const message of BuildPreviewMessages(colors)) {
		await interaction.followUp({ ...message, flags: MessageFlags.Ephemeral });
	}
}

/** Gives the member the color of the button (or takes the color away), `key` is the role id or "none" */
async function ApplyColor(interaction: ButtonInteraction, member: GuildMember, colors: ColorRoles, key: string) {
	const choice = ParseChoice(key, colors);
	if (!choice) {
		await interaction.update({ ...BuildColorPicker(colors, GetCurrentColor(member, colors)), content: COLOR_GONE_TEXT });
		return;
	}

	const color = choice === "none" ? null : choice;
	const result = await SetColor(member, colors, color);

	if (result === "ok") {
		await interaction.update({ content: "", ...BuildColorDone(color) });
	} else {
		await interaction.update({ ...BuildColorPicker(colors, GetCurrentColor(member, colors)), content: SET_COLOR_ERRORS[result] });
	}
}

// the id of the buttons is "color:<action>:<role id>", the actions are cancel, preview and apply
const button: Button = {
	data: { customId: COLOR_BUTTON_ID },
	async execute(interaction: ButtonInteraction) {
		if (!interaction.guild) return;

		const [, action, key] = interaction.customId.split(":");

		if (action === "cancel") {
			await interaction.update({ content: "Inget ändrades.", embeds: [], components: [] });
			return;
		}
		if (action === "preview") {
			await ShowPreview(interaction, GetColorRoles(interaction.guild));
			return;
		}

		const member = interaction.member as GuildMember;
		if (action !== "apply" || !(await IsVerified(member))) {
			await interaction.update({ content: "Du måste vara verifierad för att välja en färg.", embeds: [], components: [] });
			return;
		}

		const colors = GetColorRoles(interaction.guild);
		if (!colors) {
			await interaction.update({ content: NO_COLOR_ROLES_TEXT, embeds: [], components: [] });
			return;
		}

		await ApplyColor(interaction, member, colors, key ?? "");
	},
};

export default button;
