const KNOWN: Record<number, string> = {
	10003: "That channel doesn't exist anymore.",
	10008: "That message doesn't exist anymore.",
	50001: "I can't see that channel.",
	50007: "I can't send a message to that user.",
	50013: "I'm missing a permission, or my role is below the one I need to change.",
};

export function ExplainError(error: unknown): string {
	if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "number" && KNOWN[error.code]) {
		return KNOWN[error.code];
	}
	return error instanceof Error ? error.message : String(error);
}
