import type { Client } from "discord.js";
import { Team } from "discord.js";

/**
 * The user ids that own the bot, the owner first
 * A bot owned by a team gives the owner of the team and then its members
 */
export async function GetOwnerIds(client: Client): Promise<string[]> {
	const application = await client.application?.fetch().catch(() => null);
	const owner = application?.owner;
	if (!owner) return [];

	if (owner instanceof Team) {
	 	const ids = [owner.ownerId, ...owner.members.keys()];
		return [...new Set(ids.filter((id): id is string => !!id))];
	}
	return [owner.id];
}

export async function IsBotOwner(client: Client, userId: string): Promise<boolean> {
	return (await GetOwnerIds(client)).includes(userId);
}
