import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, type ButtonInteraction, type GuildMember } from "discord.js";
import {
	BuildColorDone,
	BuildColorPicker,
	COLOR_BUTTON_ID,
	GetColorRoles,
	GetCurrentColor,
	ParseChoice,
	SetColor,
} from "../../utils/colorRoles.js";
import { IsVerified } from "../../utils/permissions.js";

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
			const colors = GetColorRoles(interaction.guild);
			if (!colors) {
				await interaction.update({ content: "Det finns inga färgroller på servern längre.", embeds: [], components: [] });
				return;
			}
			await interaction.update({ content: "Skickar alla färger, vänligen kolla på stapeln till vänster om embeden.", embeds: [], components: [] });
			for (const color of colors.options) {
				const embed = new EmbedBuilder()
					.setColor(color.hex == 0xFFFFFF ? 0xFFFFFE : color.hex)
					.setDescription(`⬅️ — ${color.label} \`#${color.hex.toString(16).padStart(6, "0").toUpperCase()}\``);
				const button = new ButtonBuilder().setCustomId(`${COLOR_BUTTON_ID}:apply:${color.roleId}`).setLabel("Välj den här färgen").setStyle(ButtonStyle.Primary);
				const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
				await interaction.followUp({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
			}
			const embed = new EmbedBuilder()
				.setColor(0xFFFFFF)
				.setDescription(`❌ — Ta bort färg`);
			const button = new ButtonBuilder().setCustomId(`${COLOR_BUTTON_ID}:apply:none`).setLabel("Ta bort färg").setStyle(ButtonStyle.Danger);
			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
			await interaction.followUp({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });

			return;
		}

		const member = interaction.member as GuildMember;
		if (action !== "apply" || !(await IsVerified(member))) {
			await interaction.update({ content: "Du måste vara verifierad för att välja en färg.", embeds: [], components: [] });
			return;
		}

		const colors = GetColorRoles(interaction.guild);
		if (!colors) {
			await interaction.update({ content: "Det finns inga färgroller på servern längre.", embeds: [], components: [] });
			return;
		}

		const choice = ParseChoice(key ?? "", colors);
		if (!choice) {
			await interaction.update({
				...BuildColorPicker(colors, GetCurrentColor(member, colors)),
				content: "Den färgen finns inte längre, välj en annan.",
			});
			return;
		}

		const color = choice === "none" ? null : choice;
		const result = await SetColor(member, colors, color);

		if (result === "ok") {
			await interaction.update({ content: "", ...BuildColorDone(color) });
			return;
		}

		const errors = {
			gone: "Den färgen finns inte längre, välj en annan.",
			"missing-permission": "Jag kan inte ge dig den rollen, min roll måste ligga över färgrollerna. Be en administratör.",
			failed: "Något gick fel, försök igen.",
		};
		await interaction.update({ ...BuildColorPicker(colors, GetCurrentColor(member, colors)), content: errors[result] });
	},
};

export default button;
