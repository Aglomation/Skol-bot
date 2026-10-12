import type { ButtonInteraction, GuildMember, StringSelectMenuInteraction } from "discord.js";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	StringSelectMenuBuilder,
} from "discord.js";
import { GetServerConfig } from "./configManager.js";
import { GetProfile, PROFILE_DUPLICATE, UpdateProfile } from "./profileManager.js";
import type { VerifyOption } from "./verifyOptions.js";
import { CITIES, CLASSES, PRONOUNS, ROLE_GROUPS, YEARS } from "./verifyOptions.js";

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
		console.error("Could not give the verify roles:", error);
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
 * Gives a member everything they get for verifying: the verified role, the roles from the verify questions and the teacher role for teachers
 * Used when the form comes in (messageCreate) and by /admin manualverify
 */
export async function CompleteVerification(member: GuildMember, email: string): Promise<void> {
	const guild = member.guild;

	const verifiedRoleId = await GetServerConfig(guild.id, "verifiedRoleId");
	const verifiedRole = verifiedRoleId ? guild.roles.cache.get(verifiedRoleId) : undefined;
	if (verifiedRole) await member.roles.add(verifiedRole);

	// city, class, year and pronouns from the verify questions, if they are gone the member gets told to pick them again
	const pending = TakePendingRoles(guild.id, member.id);
	if (pending) await ApplyVerifyRoles(member, pending.roleIds, pending.asked);
	else await NotifyNoRoleAnswers(member);

	// Gives the teacher role automatically to teachers
	if (email.endsWith("@ga.lbs.se") || email.endsWith("@lbs.se")) {
		const teacherRoleId = await GetServerConfig(guild.id, "teacherRoleId");
		const teacherRole = teacherRoleId ? guild.roles.cache.get(teacherRoleId) : undefined;
		if (teacherRole) await member.roles.add(teacherRole);
	}
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
	const alumni = YEARS.find((option) => option.key === yearKey)?.alumni ?? false;
	const profile = await GetProfile(interaction.user.id, interaction.guild.id);

	// already verified with an email, they only needed the roles
	if (profile?.email) {
		const member = interaction.member as GuildMember | null;
		if (!member) return;

		const verifiedRoleId = await GetServerConfig(interaction.guild.id, "verifiedRoleId");
		const verifiedRole = verifiedRoleId ? interaction.guild.roles.cache.get(verifiedRoleId) : undefined;
		if (verifiedRole) await member.roles.add(verifiedRole);
		await ApplyVerifyRoles(member, roleIds, asked);

		await interaction.update({
			content: `You have been verified successfully!\nLinked to: ${profile.email}`,
			embeds: [],
			components: [],
		});
		return;
	}

	// Generate a random 5 character verification code, only saved if they don't have one already
	let verificationCode = profile?.verifycode ?? null;
	if (!verificationCode) {
		for (let attempt = 0; attempt < 5 && !verificationCode; attempt++) {
			const code = GenerateRandomString(5);
			const updateResult = await UpdateProfile(interaction.user.id, interaction.guild.id, { verifycode: code });

			if (updateResult === null) verificationCode = code;
			else if (updateResult !== PROFILE_DUPLICATE) break;
		}

		if (!verificationCode) {
			await interaction.update({
				content: `An error occurred while updating your profile. Please try again.`,
				embeds: [],
				components: [],
			});
			return;
		}
	}

	// the answers stay in memory until the form verifies them
	SavePendingRoles(interaction.guild.id, interaction.user.id, { roleIds, asked });

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
				`Din webbläsare måste vara inloggad på ditt **@*lbs.se**-konto.\n\n` +
				`Din kod för formuläret är: \`${verificationCode}\``,
			)
			.setColor("#f2ff00");

	const formLinkButton = new ButtonBuilder()
		.setLabel("Gå till formuläret")
		.setStyle(ButtonStyle.Link)
		.setURL(`${formURL}${verificationCode}`);

	await interaction.update({
		embeds: [embed],
		components: [new ActionRowBuilder<ButtonBuilder>().addComponents(formLinkButton)],
	});
}
