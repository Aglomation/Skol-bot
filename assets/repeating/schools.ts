import fs from "node:fs";
import axios from "axios";
import type { Client } from "discord.js";
import { CITIES } from "../../utils/verifyOptions.js";

interface UnitsResponsePartial {
	valueType: string;
	value: string;
}

type SchoolData = Record<string, { id: string; studentCount: number }>;

// The unit codes from skolverket, the keys are the same as in CITIES (utils/verifyOptions.ts)
// The name and the role id come from there so a city only has to be changed in one place
const UNIT_CODES: Record<string, { schoolUnitCode: number; medieGymnasietSchoolUnitCode?: number }> = {
	bor: { schoolUnitCode: 86888278 }, // LBS Borås
	got: { schoolUnitCode: 53231578 }, // LBS Göteborg
	hal: { schoolUnitCode: 47264019 }, // LBS Halmstad
	hel: { schoolUnitCode: 68240485 }, // LBS Helsingborg
	jon: { schoolUnitCode: 18594470 }, // LBS Jönköping
	kun: { schoolUnitCode: 64569393 }, // Drottning Blankas Gymnasieskola 🤢
	lin: { schoolUnitCode: 86787111 }, // LBS Linköping
	lun: { schoolUnitCode: 51449748 }, // LBS Lund
	mal: { schoolUnitCode: 97931189 }, // LBS Malmö
	nyk: { schoolUnitCode: 44285075 }, // LBS Nyköping
	sthn: { schoolUnitCode: 18106851 }, // LBS Stockholm Norra
	sths: { schoolUnitCode: 46256929 }, // LBS Stockholm Södra
	tro: { schoolUnitCode: 21400668 }, // LBS Trollhättan
	vax: { schoolUnitCode: 17083056 }, // LBS Växjö
	ore: { schoolUnitCode: 94207720 }, // LBS Örebro
};

const CACHE_FILE = "./cache/schools.json";

const repeating: Repeating = {
	data: {
		immediate: true,
		repeating: true,
		time: null,
		clockTime: "00:00",
	},
	async execute(_client: Client) {
		if (fs.existsSync(CACHE_FILE) && new Date().getHours() !== 0) return;

		const schoolData = await getAllSchoolData();

		fs.mkdirSync("./cache", { recursive: true });

		// written to another file first and then renamed, so /stats never reads half of it
		fs.writeFileSync(`${CACHE_FILE}.tmp`, JSON.stringify(schoolData, null, 4));
		fs.renameSync(`${CACHE_FILE}.tmp`, CACHE_FILE);
	},
};

function loadOldData(): SchoolData {
	try {
		return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8")) as SchoolData;
	} catch {
		return {};
	}
}

async function getAllSchoolData(): Promise<SchoolData> {
	const oldData = loadOldData();
	const schoolData: SchoolData = {};

	for (const city of CITIES) {
		const codes = UNIT_CODES[city.key];
		if (!codes || !city.roleId) continue;

		const studentCount = await getSchoolData(codes);
		schoolData[city.label] = {
			id: city.roleId,
			// if skolverket didn't answer, the old number is better than a 0 that makes the stats look empty
			studentCount: studentCount ?? oldData[city.label]?.studentCount ?? 0,
		};
	}

	return schoolData;
}

/**
 * The number of pupils at a school unit
 * @returns null if skolverket couldn't be reached
 */
async function fetchPupils(schoolUnitCode: number): Promise<number | null> {
	try {
		const response = await axios.get(
			`https://api.skolverket.se/planned-educations/v4/school-units/${schoolUnitCode}/statistics/gy`,
			{ timeout: 15000 },
		);

		const data = response.data?.body?.totalNumberOfPupils?.[0] as UnitsResponsePartial | undefined;
		if (!data) return null;
		if (data.valueType !== "EXISTS") return 0;

				const numericValue = parseInt(data.value.replace(/\D/g, ""), 10);
		return Number.isNaN(numericValue) ? 0 : numericValue;
	} catch (error) {
		console.error(`Error fetching schooldata for ${schoolUnitCode}:`, error);
		return null;
	}
	}

async function getSchoolData(codes: { schoolUnitCode: number; medieGymnasietSchoolUnitCode?: number }): Promise<number | null> {
	const main = await fetchPupils(codes.schoolUnitCode);
	const media = codes.medieGymnasietSchoolUnitCode
		? await fetchPupils(codes.medieGymnasietSchoolUnitCode)
		: 0;

	if (main === null || media === null) return null;
	return main + media;
}

export default repeating;
