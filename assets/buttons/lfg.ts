import type { ButtonInteraction, GuildMember } from "discord.js";
import { MessageFlags } from "discord.js";
import type { Signup } from "../../utils/lfg.js";
import {
	ApplySignup,
	BuildEmbed,
	BuildRows,
	CancelSession,
	GetSession,
	LFG_BUTTON_ID,
	SaveSessions,
	StartSession,
} from "../../utils/lfg.js";
import { IsStaff } from "../../utils/tickets.js";

const SIGNUPS: Signup[] = ["join", "maybe", "leave"];

const button: Button = {
	data: { customId: LFG_BUTTON_ID },
	async execute(interaction: ButtonInteraction) {
		const refuse = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

		const session = await GetSession(interaction.message.id);
		if (!session || (session.status !== "open" && session.status !== "started")) {
			await refuse("This session is over.");
			return;
		}

		const member = interaction.member as GuildMember;
		const action = interaction.customId.split(":")[1];
		const isHost = session.hostId === member.id;

		if (action === "start" || action === "cancel") {
			if (!isHost && !(await IsStaff(member))) {
				await refuse("Only the host can do that.");
				return;
			}

			if (action === "start") {
				await interaction.deferUpdate();
				await StartSession(interaction.client, session);
				return;
			}

			await interaction.update({ embeds: [BuildEmbed({ ...session, status: "cancelled" })], components: [] });
			await CancelSession(interaction.client, session, member.id);
			return;
		}

		if (!SIGNUPS.includes(action as Signup)) {
			await refuse("Unknown button.");
			return;
		}
		if (isHost) {
			await refuse("You're the host, press Cancel if you want to call it off.");
			return;
		}

		const result = ApplySignup(session, member.id, action as Signup);
		await SaveSessions();
		await interaction.update({ embeds: [BuildEmbed(session)], components: BuildRows(session) });

		if (result.outcome === "waitlist") {
			await interaction.followUp({ content: "It's full, you're on the waitlist and get a spot if someone leaves.", flags: MessageFlags.Ephemeral });
		}
		if (result.promoted && interaction.channel?.isSendable()) {
			await interaction.channel
				.send({
					content: `<@${result.promoted}> a spot opened up in **${session.game}**, you're in!`,
					allowedMentions: { users: [result.promoted] },
					reply: { messageReference: session.id, failIfNotExists: false },
				})
				.catch(() => null);
		}
	},
};

export default button;
