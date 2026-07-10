import type {
	Client,
	GuildTextBasedChannel,
	Message,
	TextChannel,
} from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events } from "discord.js";
import { FindByValue, UpdateProfile } from "../utils/profileManager.js";
import { purgeChannels } from "../utils/purgeMessages.js";

export default {
	name: Events.MessageCreate,
	once: false,
	async execute(message: Message, client: Client) {

		if (!message.guild && message.author.id !== client.user?.id) {
			const logChannel = client.channels.cache.get("1499149296203993169") as
			| TextChannel
			| undefined;
			if (logChannel) {
				await logChannel.send(
					`DM received from ${message.author.tag} (${message.author.id}):\n${message.content}`,
				);
			}
			return;
		}
		
		if (!message.guild) return;

		if (
			message.channel.id === "1498834244854878209" &&
			!message.member?.permissions.has("Administrator")
		) {
			await message.delete().catch(() => null);
		}

		// Honeypot
		if (
			message.channel.id === "1497140071176863755" &&
			!message.member?.permissions.has("Administrator")
		) {
			const compromisedUserId = message.author.id;

			const logChannel = client.channels.cache.get("1499149296203993169") as
				| TextChannel
				| undefined;
			if (logChannel)
				await logChannel.send(
					`Honeypot triggered by <@${compromisedUserId}>! Wiping messages`,
				);

			// Quarantine the user and delete the trigger message.
			await message.member?.timeout(3 * 24 * 60 * 60 * 1000).catch(() => null);
			await message.delete().catch(() => null);
			const channels = message.guild.channels.cache.filter((c) =>
				c.isTextBased(),
			);

			const channelsArray = channels.map((c) => c as GuildTextBasedChannel);

			const results = await purgeChannels(channelsArray, compromisedUserId);

			const totalDeleted = results.reduce((acc, curr) => acc + curr, 0);
			if (logChannel)
				await logChannel.send(
					`Honeypot wipe complete. Wiped ${totalDeleted} messages from <@${compromisedUserId}>.`,
				);
			return;
		}

		// Email Verification
		if (
			message.channel.id === "1498837870876688434" &&
			message.webhookId === "1498837897527431188"
		) {
			try {
				const [email, verify] = message.content.replace(/\s+/g, "").split("$$");
				if (!email || !verify){
					await message.reply("Invalid formatting, didn't include two parts split by $$").catch(() => null);
					return;
				}

				const profile = await FindByValue("verifycode", verify);
				if (!profile){
					await message.reply("Invalid verification code.").catch(() => null);
					return;
				}

				const userId = profile.id;
				if (!userId){
					await message.reply("Verification code found but no ID was tied to it").catch(() => null);
					return;
				}

				if (profile.email && profile.email !== email){
					await message.reply(`This verification code has already been used with a different email.\n[${profile.email}]`).catch(() => null);
					return;
				}

				if (!/@([a-z0-9-]+\.)*lbs\.se$/i.test(email) || email.includes("+")){
					await message.reply(`Sending dm to <@${profile.id}> about invalid email`).catch(() => null);
					const embed = new EmbedBuilder()
						.setTitle("❌ Ogiltig LBS-mail")
                        .setDescription(
                            `Mailen du försökte verifiera med är inte en giltig LBS-mail.\n\n` +
                            `\`${email}\` Slutar inte med @lbs.se, byt konto och försök igen!\n\n` +
                            `*Problem? Skapa en ticket i <#1499885683995840683>.*`
                        )
                        .setColor(0xFF0000);

					const button = new ButtonBuilder()
						.setLabel("Försök igen")
						.setEmoji("🔄")
						.setStyle(ButtonStyle.Link)
						.setURL(
							`https://docs.google.com/forms/d/e/1FAIpQLSdiCU7923760A1fP07hDDfgcrvUxUUQFd_yWAdXggellFVW9w/viewform?usp=pp_url&entry.952629899=${verify}`,
						);

					await message.guild?.members.cache.get(profile.id)?.send({ embeds: [embed], components: [
						new ActionRowBuilder<ButtonBuilder>().addComponents(button)
					] }).catch(() => null);
					return;
				}

				await UpdateProfile(userId, { email });

				// Fetch member
				let member = message.guild?.members.cache.get(userId) || null;
				if (!member) {
					console.error(
						`Failed to fetch member for user ID ${userId} from cache, attempting to fetch from API.`,
					);
					member = await message.guild?.members.fetch(userId).catch(() => null);
				}
				if (!member) {
					console.error(
						`Failed to fetch member for user ID ${userId} from API.`,
					);
					await message.reply("Verification succeeded but failed to fetch member data.").catch(() => null);
					return;
				}

				// Add verified role to the user
				const verifiedRole = message.guild?.roles.cache.get(
					"1498832228145168514",
				);
				if (verifiedRole) {
					await member.roles.add(verifiedRole);
				}

				// Give teacher role if email doesn't end with @elev.ga.lbs.se
				if (email.endsWith("@ga.lbs.se") || email.endsWith("@lbs.se")) {
					const teacherRole = message.guild?.roles.cache.get(
						"1497140069872435217",
					);
					if (teacherRole) {
						await member.roles.add(teacherRole);
					}
				}

				// Deletes emails after being verified
				await message.delete().catch(() => null);
			} catch (error) {
				console.error("Error processing verification webhook:", error);
			}
		}
	},
};
