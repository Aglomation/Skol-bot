import type { Client } from "discord.js";
import { sql } from "drizzle-orm";
import type { db } from "../db/client.js";
import { GetOwnerIds } from "./botOwner.js";

// ngl i vibe coded all of this
type PushPlan = {
	hasDataLoss: boolean;
	warnings: string[];
	statementsToExecute: string[];
};

type PushSchema = (schema: Record<string, unknown>, database: typeof db) => Promise<PushPlan>;

export type SchemaCheck =
	| { state: "up-to-date" }
	| { state: "unavailable"; reason: string }
	| {
			state: "pending";
			statements: string[];
			warnings: string[];
			// the statements that could remove or change data, empty when everything only adds
			risky: string[];
			safeToApply: boolean;
	  };

// What happened at startup, the owner gets told about it when the bot is online
type SyncResult = { notify: boolean; message: string };
let lastResult: SyncResult | null = null;

// Any number, it only has to be the same for every instance of the bot so two of them dont change the schema at the same time
const LOCK_KEY = 7364201;

// Only changes that add something are applied by themselves, they cant remove or change data that is already there
const SAFE_STATEMENTS = [
	/^CREATE TABLE\b/i,
	/^CREATE (UNIQUE )?INDEX\b/i,
	/^CREATE TYPE\b/i,
	/^CREATE SCHEMA\b/i,
	/^ALTER TYPE\b.*\bADD VALUE\b/is,
	/^ALTER TABLE\b.*\bADD COLUMN\b/is,
	/^ALTER TABLE\b.*\bADD CONSTRAINT\b/is,
];

// A string with several statements in it is checked one by one, so a safe first one can't hide an unsafe second one
export const IsSafeStatement = (statement: string): boolean =>
	statement
		.split(";")
		.map((part) => part.trim())
		.filter(Boolean)
		.every((part) => SAFE_STATEMENTS.some((safe) => safe.test(part)));

// drizzle-kit is only needed for this, the api has moved between versions so a few places are tried
async function LoadPushSchema(): Promise<PushSchema | null> {
	for (const specifier of ["drizzle-kit/api-postgres", "drizzle-kit/api"]) {
		try {
			const imported = await import(specifier);
			if (typeof imported.pushSchema === "function") return imported.pushSchema;
		} catch {
			// not there, try the next one
		}
	}
	return null;
}

/**
 * Compares the database with db/schema.ts like `drizzle-kit push` does, without changing anything
 * @param push Only for tests, otherwise drizzle-kit is loaded
 */
export async function CheckSchema(
	database: typeof db,
	schema: Record<string, unknown>,
	push?: PushSchema,
): Promise<SchemaCheck> {
	try {
		const pushSchema = push ?? (await LoadPushSchema());
		if (!pushSchema) {
			return {
				state: "unavailable",
				reason: "drizzle-kit is not installed (it has to be a dependency, not a devDependency), so the schema can't be checked.",
			};
		}

		const plan = await pushSchema(schema, database);
		if (!Array.isArray(plan?.statementsToExecute)) {
			return { state: "unavailable", reason: "drizzle-kit gave an answer this version of the bot doesn't understand." };
		}

		const statements = plan.statementsToExecute;
		if (statements.length === 0) return { state: "up-to-date" };

		const risky = statements.filter((statement) => !IsSafeStatement(statement));
		return {
			state: "pending",
			statements,
			warnings: plan.warnings ?? [],
			risky,
			safeToApply: !plan.hasDataLoss && risky.length === 0,
		};
	} catch (error) {
		return { state: "unavailable", reason: `Could not check the schema: ${error instanceof Error ? error.message : String(error)}` };
	}
}

/**
 * Runs the statements in one transaction, so it is all or nothing, behind a lock so two bots don't do it at once
 * Throws if it fails, nothing is changed then
 */
export async function ApplyStatements(database: typeof db, statements: string[]): Promise<void> {
	await database.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_KEY})`);
		for (const statement of statements) {
			await tx.execute(sql.raw(statement));
		}
	});
}

/**
 * Makes the database match db/schema.ts at startup, like `drizzle-kit push` but only when it is safe
 *
 * - Only additions are applied (new tables, columns, indexes), see SAFE_STATEMENTS
 * - If anything in the plan would remove or change something, NOTHING is applied, the owner is told and can look at it with /admin database
 * - It never stops the bot from starting
 *
 * Set DB_AUTO_PUSH to "apply" (default), "check" (only tell what would change) or "off"
 */
export async function SyncSchema(
	database: typeof db,
	schema: Record<string, unknown>,
	push?: PushSchema,
): Promise<void> {
	lastResult = null;
	const mode = (process.env.DB_AUTO_PUSH ?? "apply").toLowerCase();
	if (mode === "off") return;

	const check = await CheckSchema(database, schema, push);

	if (check.state === "up-to-date") {
		console.log("[Database] Schema is up to date.");
		return;
	}

	if (check.state === "unavailable") {
		console.warn(`[Database] ${check.reason}`);
		lastResult = { notify: true, message: `⚠️ The database schema was not checked at startup.\n${check.reason}` };
		return;
	}

	const list = check.statements.join("\n");

	if (!check.safeToApply) {
		console.warn(
			`[Database] The schema doesn't match the database, but applying it could remove or change data, so nothing was changed.\n${[...check.warnings, ...check.statements].join("\n")}`,
		);
		lastResult = {
			notify: true,
			message: `⚠️ The database doesn't match the schema, but fixing it could remove or change data, so nothing was changed.\nUse \`/admin database\` to look at it.`,
		};
		return;
	}

	if (mode === "check") {
		console.log(`[Database] The schema would be updated with (DB_AUTO_PUSH=check, not applied):\n${list}`);
		lastResult = { notify: true, message: `ℹ️ The database is missing ${check.statements.length} change(s), not applied because DB_AUTO_PUSH=check.\nUse \`/admin database\` to apply them.` };
		return;
	}

	try {
		await ApplyStatements(database, check.statements);
		console.log(`[Database] Schema updated, ${check.statements.length} change(s) applied:\n${list}`);
		lastResult = { notify: true, message: `✅ The database was updated at startup, ${check.statements.length} change(s) applied.` };
	} catch (error) {
		console.error("[Database] Could not update the schema, the bot starts anyway:", error);
		lastResult = {
			notify: true,
			message: `⚠️ Updating the database failed and was rolled back, nothing was changed.\n${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

/**
 * Sends what happened with the schema at startup to the owner of the bot, nothing is sent when there was nothing to do
 * The owner can't see the console of the server, so it goes in a DM
 */
export async function NotifyOwnerAboutSchema(client: Client): Promise<void> {
	if (!lastResult?.notify) return;

	const [ownerId] = await GetOwnerIds(client);
	if (!ownerId) return;

	const owner = await client.users.fetch(ownerId).catch(() => null);
	await owner?.send(`**Database**\n${lastResult.message}`).catch(() => null);
}
