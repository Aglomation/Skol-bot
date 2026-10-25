import type { GuildMember, StringSelectMenuInteraction } from "discord.js";
import { BuildColorPicker, COLOR_SELECT_ID, GetColorRoles, GetCurrentColor, ParseChoice } from "../../utils/colorRoles.js";
import { IsVerified } from "../../utils/permissions.js";

const selectMenu: SelectMenu = {
	data: { customId: COLOR_SELECT_ID },
	async execute(interaction: StringSelectMenuInteraction) {
		if (!interaction.guild) return;

		const member = interaction.member as GuildMember;
		if (!(await IsVerified(member))) {
			await interaction.update({ content: "Du måste vara verifierad för att välja en färg.", embeds: [], components: [] });
			return;
		}

		const colors = GetColorRoles(interaction.guild);
		if (!colors) {
			await interaction.update({ content: "Det finns inga färgroller på servern längre.", embeds: [], components: [] });
			return;
		}

		const current = GetCurrentColor(member, colors);
		const choice = ParseChoice(interaction.values[0], colors);
		if (!choice) {
			await interaction.update({ ...BuildColorPicker(colors, current), content: "Den färgen finns inte längre, välj en annan." });
			return;
		}

		await interaction.update({ ...BuildColorPicker(colors, current, choice), content: "" });
	},
};

export default selectMenu;
