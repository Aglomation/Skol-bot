/**
 * Looks like an email, nothing more
 * 255 is the length of the column in the database
 */
export function IsEmail(email: string): boolean {
	return email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * An email of the school, subdomains count too
 * A + in it is an alias of another address, so it doesn't count
 */
export function IsSchoolEmail(email: string): boolean {
	return email.length <= 255 && /^[^\s@]+@(?:[a-z0-9-]+\.)*(?:lbs\.se|dbgy\.se|learnet\.se)$/i.test(email) && !email.includes("+");
}

/**
 * Teachers get their role from their email
 */
export function IsTeacherEmail(email: string): boolean {
	const lower = email.toLowerCase();
	return lower.endsWith("@ga.lbs.se") || lower.endsWith("@lbs.se");
}
