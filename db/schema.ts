import {
    boolean,
    integer,
    jsonb,
    pgTable,
    text,
    varchar,
} from "drizzle-orm/pg-core";

export const userProfileTable = pgTable("user_profiles", {
    id: varchar("id", { length: 255 }).primaryKey().notNull(),
    verifycode: varchar("verifycode", { length: 4 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    timeout: integer("timeout"),
    banned: boolean("banned").notNull().default(false),
    banreason: text("banreason"),
    banduration: text("banduration"),
    birthday: jsonb("birthday"),
});
