import type { ModAction } from "../db/schema.js";

/**
 * Turns the old timeout/banned/banreason/banduration columns into actions, used when moving the old data over
 */
export function LegacyToActions(
	old: {
		timeout?: number | null;
		banned?: boolean | null;
		banreason?: string | null;
		banduration?: string | null;
	},
	now = Date.now(),
): ModAction[] {
	const actions: ModAction[] = [];

	// we dont know when or who did the old ones
	if (old.banduration || old.banreason) {
		const until = parseInt(old.banduration ?? "", 10);
		actions.push({
			type: "softban",
			at: now,
			by: null,
			reason: `${old.banreason ?? "No reason saved"} (migrated)`,
			until: Number.isNaN(until) ? null : until,
		});
	}

	if (old.timeout && old.timeout > now) {
		actions.push({
			type: "mute",
			at: now,
			by: null,
			reason: "Migrated from the old data",
			until: old.timeout,
		});
	}

	return actions;
}
