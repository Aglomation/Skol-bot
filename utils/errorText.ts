const KNOWN: Record<number, string> = {
	10003: "That channel doesn't exist anymore.",
	10008: "That message doesn't exist anymore.",
	50001: "I can't see that channel.",
	50007: "I can't send a message to that user.",
	50013: "I'm missing a permission, or my role is below the one I need to change.",
};

/**
 * drizzle puts the whole query and its values in the message (emails, ids), so a database error never goes to a log or a reply as it is
 */
function IsDatabaseError(error: unknown): error is Error {
	return error instanceof Error && (error.name === "DrizzleQueryError" || error.message.startsWith("Failed query"));
}

/**
 * The error to put in the console, without the values of a failed query
 */
export function SafeError(error: unknown): unknown {
	if (!IsDatabaseError(error)) return error;

	const cause = error.cause instanceof Error ? error.cause : null;
	const code = cause && "code" in cause ? String(cause.code) : "unknown";
	return `Database error (code ${code}): ${cause?.message ?? "no details"}`;
}

export function ExplainError(error: unknown): string {
	if (IsDatabaseError(error)) return "Something went wrong with the database.";

	if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "number" && KNOWN[error.code]) {
		return KNOWN[error.code];
	}
	return error instanceof Error ? error.message : String(error);
}
