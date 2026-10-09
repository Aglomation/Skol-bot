import { bigint, boolean, jsonb, pgTable, unique, varchar } from "drizzle-orm/pg-core";

// Everything the moderators do to a user gets saved as one of these in user_profiles.moderation
// The case number is just the position in the list (#1 is the first one), entries are never deleted so the numbers stay the same
export type ModActionType = "warn" | "mute" | "unmute" | "softban" | "unban" | "note";

export type ModAction = {
	type: ModActionType;
	at: number; // when it happened
	by: string | null; // discord id of the moderator, null if it was done by the system
	reason: string;
	until?: number | null; // only mute and softban, when it ends. null = never
	dm?: boolean; // only saved if the dm failed (false)
	voided?: { by: string; at: number; reason: string }; // set if a mod voided the case
};

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
	ticketCategory: varchar("ticket_category", { length: 255 }),
	ticketChannel: varchar("ticket_channel", { length: 255 }),
	logChannel: varchar("log_channel", { length: 255 }),
	policeChannel: varchar("police_channel", { length: 255 }),
	honeypotChannel: varchar("honeypot_channel", { length: 255 }),
	birthdayChannel: varchar("birthday_channel", { length: 255 }),
	welcomeChannel: varchar("welcome_channel", { length: 255 }),
	supportChannel: varchar("support_channel", { length: 255 }),
	modRoleId: varchar("mod_role_id", { length: 255 }),
	adminRoleId: varchar("admin_role_id", { length: 255 }),
});

export const userProfileTable = pgTable("user_profiles", {
	id: varchar("id", { length: 255 })
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	discordId: varchar("discord_id", { length: 255 }).notNull(),
	serverId: varchar("server_id", { length: 255 }).notNull(),
	verifycode: varchar("verifycode", { length: 5 }).unique(),
	email: varchar("email", { length: 255 }).unique(),
	moderation: jsonb("moderation").$type<ModAction[]>().notNull().default([]),
	birthday: bigint({ mode: "number" }),
	privacyOption: bigint({ mode: "number" }).notNull().default(2),
}, (t) => [
	unique().on(t.discordId, t.serverId)
]);