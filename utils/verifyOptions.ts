// Max 25 per list (discord limit for a menu)
// roleId null = no role

export type VerifyOption = {
	key: string;
	emoji?: string;
	label: string;
	roleId: string | null;
	alumni?: boolean; // people that probably left the school, they get the alumni info
};
export const CITIES: VerifyOption[] = [
	{ key: "bor", emoji: "✂️", label: "Borås", roleId: "1497160597220098148"  },
	{ key: "got", emoji: "🐟", label: "Göteborg", roleId: "1497160590647623690" },
	{ key: "hal", emoji: "🍓", label: "Halmstad", roleId: "1497142973668917248" },
	{ key: "hel", emoji: "🏰", label: "Helsingborg", roleId: "1497142972477734962" },
	{ key: "jon", emoji: "🌊", label: "Jönköping", roleId: "1497142974889332836" },
	{ key: "kun", emoji: "🤴", label: "Kungsbacka", roleId: "1497142971643072545" },
	{ key: "lin", emoji: "🐯", label: "Linköping", roleId: "1497142969726271538" },
	{ key: "lun", emoji: "🎓", label: "Lund", roleId: "1497149407169089536" },
	{ key: "mal", emoji: "🌉", label: "Malmö", roleId: "1497142975552290888" },
	{ key: "nyk", emoji: "🔑", label: "Nyköping", roleId: "1497140788864225360" },
	{ key: "sthn", emoji: "🌟", label: "Stockholm Norra", roleId: "1497160592056647750" },
	{ key: "sths", emoji: "👑", label: "Stockholm Södra", roleId: "1497142976835747840" },
	{ key: "tro", emoji: "🧌", label: "Trollhättan", roleId: "1497160595823263804" },
	{ key: "vax", emoji: "🌳", label: "Växjö", roleId: "1497160595085066340" },
	{ key: "ore", emoji: "🦅", label: "Örebro", roleId: "1497160592866283631" },
];

// Teachers get their role from their email
export const CLASSES: VerifyOption[] = [
	{ key: "ai", emoji: "🌐", label: "AI & Webbutveckling", roleId: "1497142963879280710" },
	{ key: "dd", emoji: "👨‍🔧", label: "Digital Design", roleId: "1497142967578923101" },
	{ key: "esport", emoji: "🎮", label: "E-sport", roleId: "1497140069872435215" },
	{ key: "foto", emoji: "📷", label: "Foto & Film", roleId: "1497140069872435214" },
	{ key: "grafisk", emoji: "🎨", label: "Grafisk Design", roleId: "1497140069872435213" },
	{ key: "musik", emoji: "🎶", label: "Musik", roleId: "1497140069872435212" },
	{ key: "spelgrafik", emoji: "🖼️", label: "Spelgrafik", roleId: "1497140069872435211" },
	{ key: "spelutv", emoji: "👾", label: "Spelutveckling", roleId: "1497140069872435210" },
	{ key: "other", emoji: "👨‍🏫", label: "Annat", roleId: null },
];

export const YEARS: VerifyOption[] = [
	{ key: "26", emoji: "👶", label: "År 26", roleId: "1497140069843079226" },
	{ key: "25", emoji: "🧑", label: "År 25", roleId: "1497140069843079225" },
	{ key: "24", emoji: "🧓", label: "År 24", roleId: "1497140069843079224" },
	{ key: "23", emoji: "🪦", label: "År 23 (har slutat)", roleId: "1497140069843079223", alumni: true },
	{ key: "22", emoji: "🪦", label: "År 22 (har slutat)", roleId: "1498635283321852006", alumni: true },
	{ key: "other", emoji: "🦖", label: "Annat (lärare)", roleId: "1497140069843079221" },
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