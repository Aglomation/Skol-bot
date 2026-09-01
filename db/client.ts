import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { relations } from "./relations.js";

dotenv.config({ quiet: true });

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not set in environment variables.");
}

export const db = drizzle({
	connection: process.env.DATABASE_URL,
	relations,
});
