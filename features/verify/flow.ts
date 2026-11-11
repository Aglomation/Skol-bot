import type { ButtonInteraction, GuildMember, StringSelectMenuInteraction } from "discord.js";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	StringSelectMenuBuilder,
} from "discord.js";
import { GetServerConfig } from "../../utils/configManager.js";
import { SafeError } from "../../utils/errorText.js";
import { GetProfile, PROFILE_DUPLICATE, UpdateProfile } from "../../utils/profileManager.js";
import { IsTeacherEmail } from "../emails.js";
import type { VerifyOption } from "./options.js";
import { CITIES, CLASSES, PRONOUNS, ROLE_GROUPS, YEARS } from "./options.js";

const formURL = "https://docs.google.com/forms/d/e/1FAIpQLSdiCU7923760A1fP07hDDfgcrvUxUUQFd_yWAdXggellFVW9w/viewform?usp=pp_url&entry.952629899=";

export type VerifyStep = "city" | "class" | "year" | "pronouns";

const STEP_ORDER: VerifyStep[] = ["city", "class", "year", "pronouns"];

const STEPS: Record<VerifyStep, { question: string; placeholder: string; options: VerifyOption[] }> = {
	city: { question: "Vilken stad går du i?", placeholder: "Välj din stad", options: CITIES },
	class: { question: "Vilken klass läser du?", placeholder: "Välj din klass", options: CLASSES },
	year: { question: "Vilket år går du i?", placeholder: "Välj ditt år", options: YEARS },
	pronouns: { question: "Vilka pronomen vill du använda?\nDu kan välja flera, eller hoppa över.", placeholder: "Välj pronomen", options: PRONOUNS },
};

// The answers are only kept in memory, never in the database for privacy
// they get cleared when it restarts or after a week
export type PendingRoles = { roleIds: string[]; asked: number[] };

const PENDING_TIME = 7 * 24 * 60 * 60 * 1000;
const pendingAnswers = new Map<string, PendingRoles & { expires: number }>();

function SavePendingRoles(guildId: string, userId: string, pending: PendingRoles): void {
	// clean out the old ones so the map doesnt just grow
	for (const [key, value] of pendingAnswers) {
		if (value.expires < Date.now()) pendingAnswers.delete(key);
	}
	pendingAnswers.set(`${guildId}:${userId}`, { ...pending, expires: Date.now() + PENDING_TIME });
}

/**
 * Gets the saved answers and removes them from memory
 * @returns null if they never answered or the bot was restarted
 */
export function TakePendingRoles(guildId: string, userId: string): PendingRoles | null {
	const key = `${guildId}:${userId}`;
	const pending = pendingAnswers.get(key);
	pendingAnswers.delete(key);
	if (!pending || pending.expires < Date.now()) return null;
	return { roleIds: pending.roleIds, asked: pending.asked };
}

/**
 * For when they got verified but their answers are gone, tells them how to pick the roles again
 */
export async function NotifyNoRoleAnswers(member: GuildMember): Promise<void> {
	await member
		.send(
			`## Välj dina roller\n` +
			`Du är verifierad! Boten sparar inte dina val av stad, klass, år och pronomen (av integritetsskäl), de försvann när botten startades om, vänligen gör en support ticket :D\n`
		)
		.catch(() => null);
}

/**
 * For when they got verified but some of their roles couldn't be given (the bots role is probably too low)
 */
async function NotifyRolesFailed(member: GuildMember): Promise<void> {
	await member
		.send(
			`## Välj dina roller\n` +
			`Du är verifierad! Jag kunde tyvärr inte ge dig alla roller från dina val, använd \`/roles all\` för att välja dem igen eller gör en support ticket :D\n`
		)
		.catch(() => null);
}

// the groups in ROLE_GROUPS
const GROUP_PRONOUNS = 3;

function GenerateRandomString(length: number) {
	// 36 ^ 5 = 60_466_176
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
	let result = "";
	for (let i = 0; i < length; i++) {
		const randomIndex = Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / (2 ** 32 / chars.length));
		result += chars[randomIndex];
	}
	return result;
}

/**
 * Makes the message for one of the questions
 * The answers so far are saved in the custom ids so nothing has to be kept in memory
 * @param state The keys of the earlier answers, in order
 * @param mode verify is for new members, roles is for members that are already verified (/roles)
 * @param pronounsOnly the /roles pronouns version, just the pronoun question with a button to remove them
 */
export function BuildStep(step: VerifyStep, state: string[], mode: "verify" | "roles" = "verify", pronounsOnly = false) {
	const info = STEPS[step];

	const menu = new StringSelectMenuBuilder()
		.setCustomId([`${mode}select`, step, ...state].join(":"))
		.setPlaceholder(info.placeholder)
		.addOptions(info.options.map((option) => ({ label: option.label, value: option.key })));

	// pronouns can be more than one
	if (step === "pronouns") menu.setMinValues(1).setMaxValues(info.options.length);

	const embed = new EmbedBuilder()
		.setTitle(
			pronounsOnly
				? "Pronomen"
				: `${mode === "verify" ? "Verifiering" : "Ändra roller"}, steg ${STEP_ORDER.indexOf(step) + 1} av ${STEP_ORDER.length}`,
		)
		.setDescription(info.question + (pronounsOnly ? "\nDitt val ersätter dina nuvarande pronomen." : ""))
		.setColor(0x87CFEB);

	const rows: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [
		new ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>().addComponents(menu),
	];

	if (step === "pronouns") {
		const skip = new ButtonBuilder()
			.setCustomId(pronounsOnly ? "rolesskip:clear" : [`${mode}skip`, ...state].join(":"))
			.setLabel(pronounsOnly ? "Ta bort mina pronomen" : "Hoppa över")
			.setStyle(ButtonStyle.Secondary);
		rows.push(new ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>().addComponents(skip));
	}

	return { embeds: [embed], components: rows };
}

/**
 * Turns the keys they picked into role ids
 */
function ResolveRoles(cityKey: string, classKey: string, yearKey: string, pronounKeys: string[]): string[] {
	const picks: [VerifyOption[], string[]][] = [
		[CITIES, [cityKey]],
		[CLASSES, [classKey]],
		[YEARS, [yearKey]],
		[PRONOUNS, pronounKeys],
	];

	const roleIds: string[] = [];
	for (const [options, keys] of picks) {
		for (const key of keys) {
			const roleId = options.find((option) => option.key === key)?.roleId;
			if (roleId) roleIds.push(roleId);
		}
	}
	return roleIds;
}

/**
 * Gives the city, class, year and pronoun roles
 * Only roles from the verify lists are touched, and picking a new one in a group replaces the old one
 * @param asked The groups they answered (index in ROLE_GROUPS), an answered group with no role (like class Annat) is cleared
 * @returns false if the roles couldn't be given (the bots role is probably too low)
 */
export async function ApplyVerifyRoles(member: GuildMember, roleIds: string[], asked: number[] = []): Promise<boolean> {
	const add: string[] = [];
	const remove: string[] = [];

	ROLE_GROUPS.forEach((group, index) => {
		const chosen = group.options
			.map((option) => option.roleId)
			.filter((id): id is string => !!id && roleIds.includes(id));

		// nothing picked in this group and it wasn't asked, leave what they already have
		if (chosen.length === 0 && !asked.includes(index)) return;

		for (const option of group.options) {
			if (!option.roleId) continue;
			if (chosen.includes(option.roleId)) add.push(option.roleId);
			else if (member.roles.cache.has(option.roleId)) remove.push(option.roleId);
		}

		if (chosen.length > 0) add.push(group.separator);
		else if (member.roles.cache.has(group.separator)) remove.push(group.separator);
	});

	// skip roles that were deleted from the server
	const exists = (id: string) => member.guild.roles.cache.has(id);

	try {
		const toRemove = remove.filter(exists);
		if (toRemove.length > 0) await member.roles.remove(toRemove);
		const toAdd = add.filter(exists);
		if (toAdd.length > 0) await member.roles.add(toAdd);
		return true;
	} catch (error) {
		console.error("Could not give the verify roles:", SafeError(error));
		return false;
	}
}

// city, class and year are always asked, pronouns can be skipped
function AskedGroups(pronounKeys: string[]): number[] {
	return pronounKeys.length > 0 ? [0, 1, 2, GROUP_PRONOUNS] : [0, 1, 2];
}

/**
 * Makes sure it's a verified member, for the /roles command
 */
async function GetVerifiedMember(interaction: StringSelectMenuInteraction | ButtonInteraction): Promise<GuildMember | null> {
	if (!interaction.guild) return null;
	const member = interaction.member as GuildMember | null;
	const verifiedRoleId = await GetServerConfig(interaction.guild.id, "verifiedRoleId") as string | null;

	if (!member || !verifiedRoleId || !member.roles.cache.has(verifiedRoleId)) {
		await interaction.update({
			content: "Du måste vara verifierad för att ändra dina roller.",
			embeds: [],
			components: [],
		});
		return null;
	}
	return member;
}

/**
 * The end of /roles all, gives the roles straight away (they are already verified)
 */
export async function FinishRoles(
	interaction: StringSelectMenuInteraction | ButtonInteraction,
	cityKey: string,
	classKey: string,
	yearKey: string,
	pronounKeys: string[],
): Promise<void> {
	const member = await GetVerifiedMember(interaction);
	if (!member) return;

	const success = await ApplyVerifyRoles(member, ResolveRoles(cityKey, classKey, yearKey, pronounKeys), AskedGroups(pronounKeys));

	await interaction.update({
		content: success ? "Dina roller är uppdaterade." : "Jag kunde inte ge dig rollerna, kontakta en administratör.",
		embeds: [],
		components: [],
	});
}

/**
 * The end of /roles pronouns, no keys removes all of their pronouns
 */
export async function SetPronouns(
	interaction: StringSelectMenuInteraction | ButtonInteraction,
	pronounKeys: string[],
): Promise<void> {
	const member = await GetVerifiedMember(interaction);
	if (!member) return;

	const roleIds = ResolveRoles("", "", "", pronounKeys);
	const success = await ApplyVerifyRoles(member, roleIds, [GROUP_PRONOUNS]);

	await interaction.update({
		content: success
			? (pronounKeys.length > 0 ? "Dina pronomen är uppdaterade." : "Dina pronomen är borttagna.")
			: "Jag kunde inte ge dig rollerna, kontakta en administratör.",
		embeds: [],
		components: [],
	});
}

/**
 * Gives the teacher role if the email is one of a teacher
 */
async function GiveTeacherRole(member: GuildMember, email: string): Promise<void> {
	if (!IsTeacherEmail(email)) return;

	const teacherRoleId = await GetServerConfig(member.guild.id, "teacherRoleId");
	const teacherRole = teacherRoleId ? member.guild.roles.cache.get(teacherRoleId) : undefined;
	if (teacherRole) await member.roles.add(teacherRole);
}

/** Gives the verified role if the server has one, throws if the bot can't (its role is probably too low) */
async function GiveVerifiedRole(member: GuildMember): Promise<void> {
	const verifiedRoleId = await GetServerConfig(member.guild.id, "verifiedRoleId");
	const verifiedRole = verifiedRoleId ? member.guild.roles.cache.get(verifiedRoleId) : undefined;
	if (verifiedRole) await member.roles.add(verifiedRole);
}

/**
 * Gives a member everything they get for verifying: the verified role, the roles from the verify questions and the teacher role for teachers
 * Used when the form comes in (messageCreate) and by /admin verify manual
 * @returns false if the verified or teacher role couldn't be given (the bots role is probably too low)
 */
export async function CompleteVerification(member: GuildMember, email: string): Promise<boolean> {
	try {
		await GiveVerifiedRole(member);
	} catch (error) {
		console.error("Could not give the verified role:", SafeError(error));
		return false;
	}

	// city, class, year and pronouns from the verify questions, if they are gone the member gets told to pick them again
	const pending = TakePendingRoles(member.guild.id, member.id);
	if (pending) {
		if (!(await ApplyVerifyRoles(member, pending.roleIds, pending.asked))) await NotifyRolesFailed(member);
	} else {
		await NotifyNoRoleAnswers(member);
	}

	// Gives the teacher role automatically to teachers
	try {
		await GiveTeacherRole(member, email);
	} catch (error) {
		console.error("Could not give the teacher role:", SafeError(error));
		return false;
	}

	return true;
}

const VERIFY_CODE_LENGTH = 5;
const VERIFY_CODE_ATTEMPTS = 5;

/**
 * Someone who already verified with an email (they left and came back, or picked their roles again) only needs their roles, there is no form
 */
async function RestoreVerifiedMember(
	interaction: StringSelectMenuInteraction | ButtonInteraction,
	email: string,
	roleIds: ReturnType<typeof ResolveRoles>,
	asked: ReturnType<typeof AskedGroups>,
): Promise<void> {
	const member = interaction.member as GuildMember | null;
	if (!member) return;

	await GiveVerifiedRole(member);
	const rolesGiven = await ApplyVerifyRoles(member, roleIds, asked);

	// a teacher that left and came back gets the teacher role again, same as when they first verified
	await GiveTeacherRole(member, email);

	await interaction.update({
		content:
			`You have been verified successfully!\nLinked to: ${email}` +
			(rolesGiven ? "" : "\nI couldn't give you all of your roles, use `/roles all` to pick them again or make a support ticket."),
		embeds: [],
		components: [],
	});
}

/**
 * The code the person types in the form, so the form answer can be tied to their account
 * They keep the code they already have, a new one is made (and saved) if not
 * @returns null if it couldn't be saved
 */
async function GetVerifyCode(userId: string, guildId: string, existingCode: string | null): Promise<string | null> {
	if (existingCode) return existingCode;

	for (let attempt = 0; attempt < VERIFY_CODE_ATTEMPTS; attempt++) {
		const code = GenerateRandomString(VERIFY_CODE_LENGTH);
		const result = await UpdateProfile(userId, guildId, { verifycode: code });

		if (result === null) return code;
		// the code is unique, so a duplicate is just bad luck and another try can work, anything else won't get better
		if (result !== PROFILE_DUPLICATE) return null;
	}

	return null;
}

/** The message with the code and the link to the form, alumni get another text (they can't log in with a school account) */
function BuildFormMessage(verificationCode: string, alumni: boolean) {
	const embed = alumni
		? new EmbedBuilder()
				.setTitle("Verifiering för alumner")
				.setDescription(
					`Du har valt ett år där de flesta har tagit studenten.\n\n` +
						`Har du tagit studenten och inte längre har en skolmail: svara **Ja** på frågan om studenten i formuläret och skicka in bevis, så verifierar en moderator dig manuellt. Du får dina roller då.\n\n` +
						`Går du fortfarande kvar på skolan: logga in med ditt **@*lbs.se**-konto och svara **Nej**.\n\n` +
						`Din kod för formuläret är: \`${verificationCode}\``,
				)
				.setColor("#f2ff00")
		: new EmbedBuilder()
				.setTitle("⚠️ Viktigt")
				.setDescription(
					`Din webbläsare måste vara inloggad på ditt **@*lbs.se**-konto.\n\n` + `Din kod för formuläret är: \`${verificationCode}\``,
				)
				.setColor("#f2ff00");

	const formLinkButton = new ButtonBuilder().setLabel("Gå till formuläret").setStyle(ButtonStyle.Link).setURL(`${formURL}${verificationCode}`);

	return { embeds: [embed], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(formLinkButton)] };
}

/**
 * Called after the last question, saves the answers with the verify code and shows the form
 * If they already have an email they are verified straight away
 */
export async function FinishVerify(
	interaction: StringSelectMenuInteraction | ButtonInteraction,
	cityKey: string,
	classKey: string,
	yearKey: string,
	pronounKeys: string[],
): Promise<void> {
	if (!interaction.guild) return;

	const roleIds = ResolveRoles(cityKey, classKey, yearKey, pronounKeys);
	const asked = AskedGroups(pronounKeys);
	const profile = await GetProfile(interaction.user.id, interaction.guild.id);

	if (profile?.email) {
		await RestoreVerifiedMember(interaction, profile.email, roleIds, asked);
		return;
	}

	const verificationCode = await GetVerifyCode(interaction.user.id, interaction.guild.id, profile?.verifycode ?? null);
	if (!verificationCode) {
		await interaction.update({ content: `An error occurred while updating your profile. Please try again.`, embeds: [], components: [] });
		return;
	}

	// the answers stay in memory until the form verifies them
	SavePendingRoles(interaction.guild.id, interaction.user.id, { roleIds, asked });

	const alumni = YEARS.find((option) => option.key === yearKey)?.alumni ?? false;
	await interaction.update(BuildFormMessage(verificationCode, alumni));
}
