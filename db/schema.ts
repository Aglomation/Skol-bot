import { bigint, boolean, pgTable, text, unique, varchar } from "drizzle-orm/pg-core";

export const serverConfigTable = pgTable("server_config", {
	id: varchar("id", { length: 255 }).primaryKey().notNull(),
	isDevServer: boolean("is_dev_server").notNull().default(false),
	verificationChannelId: varchar("verification_channel_id", {
		length: 255,
	}),
	verifiedRoleId: varchar("verified_role_id", { length: 255 }),
	teacherRoleId: varchar("teacher_role_id", { length: 255 }),
	tempvcCategory: varchar("tempvc_category", { length: 255 }),
	tempVcMainChannel: varchar("tempvc_main_channel", { length: 255 }),
	logChannel: varchar("log_channel", { length: 255 }),
	policeChannel: varchar("police_channel", { length: 255 }),
	honeypotChannel: varchar("honeypot_channel", { length: 255 }),
	birthdayChannel: varchar("birthday_channel", { length: 255 }),
});

export const userProfileTable = pgTable("user_profiles", {
	id: varchar("id", { length: 255 })
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
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
}, (t) => [
	unique().on(t.discordId, t.serverId)
]);