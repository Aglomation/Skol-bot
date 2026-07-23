import { bigint, boolean, pgTable, text, varchar } from "drizzle-orm/pg-core";

export const serverConfigTable = pgTable("server_config", {
	id: varchar("id", { length: 255 }).primaryKey().notNull(),
	isDevServer: boolean("is_dev_server").notNull().default(false),
	verificationChannelId: varchar("verification_channel_id", {
		length: 255,
	}),
	verificationMessageId: varchar("verification_message_id", { length: 255 }),
	verifiedRoleId: varchar("verified_role_id", { length: 255 }),
	verificationTimeout: bigint("verification_timeout", { mode: "number" }),
	privacyOption: bigint("privacy_option", { mode: "number" })
		.notNull()
		.default(2),
	verifyBackend: varchar("verify_backend", { length: 255 }),
	tempvcCategory: varchar("tempvc_category", { length: 255 }),
	tempVcMainChannel: varchar("tempvc_main_channel", { length: 255 }),
	logChannel: varchar("log_channel", { length: 255 }),
});

export const userProfileTable = pgTable("user_profiles", {
	id: varchar("id", { length: 255 }).primaryKey(),
	discordId: varchar("discord_id", { length: 255 }).notNull(),
	serverId: varchar("server_id", { length: 255 }).notNull(),
	verifycode: varchar("verifycode", { length: 5 }).unique(),
	email: varchar("email", { length: 255 }).unique(),
	timeout: bigint({ mode: "number" }),
	banned: boolean("banned").notNull().default(false),
	banreason: text("banreason"),
	banduration: text("banduration"),
	birthday: bigint({ mode: "number" }),
	privacyOption: bigint({ mode: "number" }).notNull().default(2),
});
