import type { Client, GuildTextBasedChannel, Message, TextChannel } from "discord.js";
import {
	Events,
} from "discord.js";
import { GetProfile, UpdateProfile } from "../utils/profileManager.js";
import { purgeChannels } from "../utils/purgeMessages.js";

export default {
	name: Events.MessageCreate,
	once: false,
	async execute(message: Message, client: Client) {
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
				// Removes all whitespace before splitting
				const [email, verify] = message.content.replace(/\s+/g, "").split("$$");
				if (!email || !verify) return;

				if (!email.endsWith("lbs.se")) return;
				if (email.includes("+")) return;

				const profile = await GetProfile(message.author.id);
				if (!profile) return; // exit if profile is invalid

				await UpdateProfile(message.author.id, { email });

				// Fetch member
				let member = message.guild?.members.cache.get(message.author.id) || null;
				if (!member){
					console.error(`Failed to fetch member for user ID ${message.author.id} from cache, attempting to fetch from API.`);
					member = await message.guild?.members
					.fetch(message.author.id)
					.catch(() => null);
				}
				if (!member) {
					console.error(`Failed to fetch member for user ID ${message.author.id} from API.`);
					return;
				}

				// Add verified role to the user
				const verifiedRole = message.guild?.roles.cache.get("1498832228145168514");
				if (verifiedRole) {
					await member.roles.add(verifiedRole);
				}

				// Give teacher role if email doesn't end with @elev.ga.lbs.se
				if (!email.endsWith("@elev.ga.lbs.se")) {
					const teacherRole = message.guild?.roles.cache.get("1497140069872435217");
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
