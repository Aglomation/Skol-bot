// Max 25 per list (discord limit for a menu)
// roleId null = no role

export type VerifyOption = {
	key: string;
	label: string;
	roleId: string | null;
	alumni?: boolean; // people that probably left the school, they get the alumni info
};

export const CITIES: VerifyOption[] = [
	{ key: "bor", label: "Borås", roleId: "1497160597220098148" },
	{ key: "got", label: "Göteborg", roleId: "1497160590647623690" },
	{ key: "hal", label: "Halmstad", roleId: "1497142973668917248" },
	{ key: "hel", label: "Helsingborg", roleId: "1497142972477734962" },
	{ key: "jon", label: "Jönköping", roleId: "1497142974889332836" },
	{ key: "kun", label: "Kungsbacka", roleId: "1497142971643072545" },
	{ key: "lin", label: "Linköping", roleId: "1497142969726271538" },
	{ key: "lun", label: "Lund", roleId: "1497149407169089536" },
	{ key: "mal", label: "Malmö", roleId: "1497142975552290888" },
	{ key: "nyk", label: "Nyköping", roleId: "1497140788864225360" },
	{ key: "sthn", label: "Stockholm Norra", roleId: "1497160592056647750" },
	{ key: "sths", label: "Stockholm Södra", roleId: "1497142976835747840" },
	{ key: "tro", label: "Trollhättan", roleId: "1497160595823263804" },
	{ key: "vax", label: "Växjö", roleId: "1497160595085066340" },
	{ key: "ore", label: "Örebro", roleId: "1497160592866283631" },
];

// Teachers get their role from their email
export const CLASSES: VerifyOption[] = [
	{ key: "ai", label: "AI & Webbutveckling", roleId: "1497142963879280710" },
	{ key: "dd", label: "Digital Design", roleId: "1497142967578923101" },
	{ key: "esport", label: "E-sport", roleId: "1497140069872435215" },
	{ key: "foto", label: "Foto & Film", roleId: "1497140069872435214" },
	{ key: "grafisk", label: "Grafisk Design", roleId: "1497140069872435213" },
	{ key: "musik", label: "Musik", roleId: "1497140069872435212" },
	{ key: "spelgrafik", label: "Spelgrafik", roleId: "1497140069872435211" },
	{ key: "spelutv", label: "Spelutveckling", roleId: "1497140069872435210" },
	{ key: "other", label: "Annat", roleId: null },
];

export const YEARS: VerifyOption[] = [
	{ key: "26", label: "År 26", roleId: "1497140069843079226" },
	{ key: "25", label: "År 25", roleId: "1497140069843079225" },
	{ key: "24", label: "År 24", roleId: "1497140069843079224" },
	{ key: "23", label: "År 23 (har slutat)", roleId: "1497140069843079223", alumni: true },
	{ key: "22", label: "År 22 (har slutat)", roleId: "1498635283321852006", alumni: true },
	{ key: "other", label: "Annat (lärare)", roleId: "1497140069843079221" },
];

export const PRONOUNS: VerifyOption[] = [
	{ key: "any", label: "Any", roleId: "1497140069843079219" },
	{ key: "hehim", label: "He/Him", roleId: "1497140069843079218" },
	{ key: "sheher", label: "She/Her", roleId: "1497140069805592745" },
	{ key: "theythem", label: "They/Them", roleId: "1497140069805592744" },
	{ key: "itits", label: "It/Its", roleId: "1502751426819129454" },
	{ key: "other", label: "Other/Ask", roleId: "1497140069805592743" },
];

// separator roles
export const ROLE_GROUPS: { options: VerifyOption[]; separator: string }[] = [
	{ options: CITIES, separator: "1497140674435350639" },
	{ options: CLASSES, separator: "1497140069872435218" },
	{ options: YEARS, separator: "1497140069843079227" },
	{ options: PRONOUNS, separator: "1497140069843079220" },
];
