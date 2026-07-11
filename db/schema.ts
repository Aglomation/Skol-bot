import {
	bigint,
	boolean,
	pgTable,
	text,
	varchar,
} from "drizzle-orm/pg-core";

export const userProfileTable = pgTable("user_profiles", {
	id: varchar("id", { length: 255 }).primaryKey().notNull(),
	verifycode: varchar("verifycode", { length: 8 }).unique(),
	email: varchar("email", { length: 255 }).unique(),
	timeout: bigint({ mode: "number" }),
	banned: boolean("banned").notNull().default(false),
	banreason: text("banreason"),
	banduration: text("banduration"),
	birthday: bigint({ mode: "number" }),
	privacyOption: bigint({ mode: "number" }).notNull().default(2),
});
