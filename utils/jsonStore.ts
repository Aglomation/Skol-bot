import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * A small file in cache/ that is read once and written whole, the file is on the volume so it survives a redeploy
 * Everyone who asks at the same time gets the same object, and saves wait for each other
 */
export function CreateJsonStore<T>(file: string, createEmpty: () => T) {
	let loading: Promise<T> | null = null;
	let saving: Promise<void> = Promise.resolve();

	async function Load(): Promise<T> {
		try {
			return JSON.parse(await readFile(file, "utf-8")) as T;
		} catch (error) {
			if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
				console.error(`Could not read ${file}, it was kept as ${file}.corrupt:`, error);
				await rename(file, `${file}.corrupt`).catch(() => null);
			}
			return createEmpty();
		}
	}

	const Get = (): Promise<T> => (loading ??= Load());

	async function Write(): Promise<void> {
		const data = await Get();
		await mkdir(dirname(file), { recursive: true });
		await writeFile(`${file}.tmp`, JSON.stringify(data));
		await rename(`${file}.tmp`, file);
	}

	const Save = (): Promise<void> => {
		saving = saving.then(Write).catch((error) => console.error(`Could not save ${file}:`, error));
		return saving;
	};

	return { Get, Save };
}
