import type { Guild, GuildMember, Role } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from "discord.js";

export type ColorOption = {
	roleId: string;
	label: string;
	hex: number;
};

export type ColorChoice = ColorOption | "none";
export type ColorResult = "ok" | "gone" | "missing-permission" | "failed";
export type ColorRoles = { separator: Role; options: ColorOption[] };

export const COLOR_SELECT_ID = "colorselect";
export const COLOR_BUTTON_ID = "color";

const MAX_COLORS = 24;
const EMBED_COLOR = 0x87ceeb;

const COLOR_HEADER = /^-{3,}\s*(colou?rs?|färg(er)?)\s*-{3,}$/i;
const SEPARATOR = /^-{3,}[^{}]*-{3,}$/;
const LABEL = /\{(.+?)\}/;

const HexText = (hex: number) => (hex === 0 ? "Ingen färg" : `#${hex.toString(16).padStart(6, "0").toUpperCase()}`);

/**
 * Finds the color roles on the server, the {Name} roles under the Color separator until the next separator
 * @returns null if the server has no color roles
 */
export function GetColorRoles(guild: Guild): ColorRoles | null {
	const roles = [...guild.roles.cache.values()].sort((a, b) => b.position - a.position);
	const start = roles.findIndex((role) => COLOR_HEADER.test(role.name.trim()));
	if (start === -1) return null;

	const options: ColorOption[] = [];
	for (const role of roles.slice(start + 1)) {
		const name = role.name.trim();
		const color = role.colors.primaryColor;
		if (SEPARATOR.test(name)) break;

		const label = name.match(LABEL)?.[1].trim();
		if (!label || role.managed) continue;
		options.push({ roleId: role.id, label: label.slice(0, 100), hex: color });
	}

	if (options.length === 0) return null;
	if (options.length > MAX_COLORS) console.warn(`There are ${options.length} color roles, only the first ${MAX_COLORS} fit in the menu.`);

	return { separator: roles[start], options: options.slice(0, MAX_COLORS) };
}

export function GetCurrentColor(member: GuildMember, colors: ColorRoles): ColorOption | null {
	return colors.options.find((option) => member.roles.cache.has(option.roleId)) ?? null;
}

export function ParseChoice(key: string, colors: ColorRoles): ColorChoice | null {
	return key === "none" ? "none" : (colors.options.find((option) => option.roleId === key) ?? null);
}

/**
 * Gives the color and takes away their other colors, null removes all of them
 * The separator role goes along with it like the other role groups
 */
export async function SetColor(member: GuildMember, colors: ColorRoles, choice: ColorOption | null): Promise<ColorResult> {
	const roles = member.guild.roles.cache;
	const target = choice ? roles.get(choice.roleId) : undefined;
	if (choice && !target) return "gone";

	const has = (role: Role) => member.roles.cache.has(role.id);

	const add: Role[] = [];
	if (target && !has(target)) add.push(target);
	if (target && !has(colors.separator)) add.push(colors.separator);

	const remove = colors.options
		.map((option) => roles.get(option.roleId))
		.filter((role): role is Role => !!role && has(role) && role.id !== target?.id);
	if (!target && has(colors.separator)) remove.push(colors.separator);

	if ([...add, ...remove].some((role) => !role.editable)) return "missing-permission";

	try {
		if (add.length > 0) await member.roles.add(add);
		if (remove.length > 0) await member.roles.remove(remove);
		return "ok";
	} catch (error) {
		console.error("Could not give the color role:", error);
		return "failed";
	}
}

export function BuildColorPicker(colors: ColorRoles, current: ColorOption | null, preview: ColorChoice | null = null) {
	const shown = preview === "none" ? null : (preview ?? current);
	const shownHex = shown ? (shown.hex === 0xffffff ? 0xfffffe : shown.hex) : null;
	const overview = colors.options.map((option) => `${option.label} ${HexText(option.hex)}`).join("\n");

	let text = `Din färg: ${current ? `**${current.label}**` : "ingen"}\n ⬅️ Förhandsvisning av färgen du valt.`;
	if (preview === "none") text = "Vill du ta bort din färg?";
	else if (preview) text = `⬅️ **${preview.label}** \`${HexText(preview.hex)}\`\nTryck på **Använd** för att välja den.`;

	const embed = new EmbedBuilder()
		.setTitle("Välj din färg")
		.setDescription(`${overview}\n\n${text}`)
		.setColor(shownHex ?? EMBED_COLOR);

	const selected = preview ?? current;
	const menu = new StringSelectMenuBuilder()
		.setCustomId(COLOR_SELECT_ID)
		.setPlaceholder("Välj en färg")
		.addOptions(
			...colors.options.map((option) => ({
				label: option.label,
				value: option.roleId,
				description: HexText(option.hex),
				default: selected !== null && selected !== "none" && selected.roleId === option.roleId,
			})),
			{ label: "Ingen färg", value: "none", emoji: { name: "✖️" }, description: "Ta bort din färg", default: selected === "none" },
		);

	const rows: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [
		new ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>().addComponents(menu),
	];

	if (preview !== null) {
		const key = preview === "none" ? "none" : preview.roleId;
		rows.push(
			new ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId(`${COLOR_BUTTON_ID}:apply:${key}`)
					.setLabel(preview === "none" ? "Ta bort färg" : "Använd")
					.setStyle(preview === "none" ? ButtonStyle.Danger : ButtonStyle.Success),
				new ButtonBuilder().setCustomId(`${COLOR_BUTTON_ID}:cancel`).setLabel("Avbryt").setStyle(ButtonStyle.Secondary),
			),
		);
	} else {
		rows.push(
			new ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>().addComponents(
				new ButtonBuilder().setCustomId(`${COLOR_BUTTON_ID}:preview`).setLabel("Visa alla färger").setStyle(ButtonStyle.Primary).setEmoji("🔍"),
			),
		);
	}

	return { embeds: [embed], components: rows };
}

export function BuildColorDone(color: ColorOption | null) {
	const embed = new EmbedBuilder()
		.setColor(color && color.hex !== 0 ? color.hex : EMBED_COLOR)
		.setDescription(color ? `Din färg är nu **${color.label}**.` : "Din färg är borttagen.");

	return { embeds: [embed], components: [] };
}
