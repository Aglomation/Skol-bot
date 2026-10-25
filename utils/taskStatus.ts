export type TaskStatus = {
	lastRun: number | null;
	lastError: string | null;
	lastErrorAt: number | null;
};

const tasks = new Map<string, TaskStatus>();

export function RegisterTask(name: string): void {
	if (!tasks.has(name)) tasks.set(name, { lastRun: null, lastError: null, lastErrorAt: null });
}

export function RecordTaskRun(name: string, error?: unknown): void {
	RegisterTask(name);
	const status = tasks.get(name) as TaskStatus;

	if (error === undefined) {
		status.lastRun = Date.now();
		return;
	}

	status.lastError = (error instanceof Error ? error.message : String(error)).slice(0, 150);
	status.lastErrorAt = Date.now();
}

export function GetTasks(): [string, TaskStatus][] {
	return [...tasks.entries()];
}
