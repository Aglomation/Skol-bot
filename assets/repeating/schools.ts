import fs from "node:fs";
import axios from "axios";
import type { Client } from "discord.js";

interface Schools {
	schoolUnitCode: number;
	name: string;
	id: string;
	medieGymnasietSchoolUnitCode?: number;
}

interface UnitsResponsePartial {
	valueType: string;
	value: string;
}

const SchoolList: Schools[] = [
	{
		name: "Borås",
		id: "1497160597220098148",
		schoolUnitCode: 86888278,
	},
	{
		name: "Göteborg",
		id: "1497160590647623690",
		schoolUnitCode: 53231578,
		medieGymnasietSchoolUnitCode: 97382366,
	},
	{
		name: "Halmstad",
		id: "1497142973668917248",
		schoolUnitCode: 47264019,
	},
	{
		name: "Helsingborg",
		id: "1497142972477734962",
		schoolUnitCode: 68240485,
	},
	{
		name: "Jönköping",
		id: "1497142974889332836",
		schoolUnitCode: 18594470,
	},
	{
		name: "Kungsbacka",
		id: "1497142971643072545",
		schoolUnitCode: 86888278,
	},
	{
		name: "Linköping",
		id: "1497142969726271538",
		schoolUnitCode: 86787111,
	},
	{
		name: "Lund",
		id: "1497149407169089536",
		schoolUnitCode: 51449748,
	},
	{
		name: "Malmö",
		id: "1497142975552290888",
		schoolUnitCode: 97931189,
	},
	{
		name: "Nyköping",
		id: "1497140788864225360",
		schoolUnitCode: 44285075,
	},
	{
		name: "Stockholm Norra",
		id: "1497160592056647750",
		schoolUnitCode: 18106851,
	},
	{
		name: "Stockholm Södra",
		id: "1497142976835747840",
		schoolUnitCode: 46256929,
	},
	{
		name: "Trollhättan",
		id: "1497160595823263804",
		schoolUnitCode: 21400668,
	},
	{
		name: "Växjö",
		id: "1497160595085066340",
		schoolUnitCode: 17083056,
	},
	{
		name: "Örebro",
		id: "1497160592866283631",
		schoolUnitCode: 94207720,
	},
];

const repeating: Repeating = {
	data: {
		immediate: true,
		repeating: true,
		time: null,
		clockTime: "00:00",
	},
	async execute(_client: Client) {
		if (fs.existsSync("./cache/schools.json") && new Date().getHours() !== 0) return;

		getAllSchoolData().then((schoolData) => {
			fs.mkdirSync("./cache", { recursive: true });
			fs.writeFileSync(
				"./cache/schools.json",
				JSON.stringify(schoolData, null, 4)
			);
		});
	},
};

async function getAllSchoolData(): Promise<{
	[key: string]: { id: string; studentCount: number };
}> {
	const schoolData: { [key: string]: { id: string; studentCount: number } } =
		{};

	for (const school of SchoolList) {
		const studentCount = await getSchoolData(school);
		schoolData[school.name] = {
			id: school.id,
			studentCount,
		};
	}

	const schoolPromises = SchoolList.map(async (school) => {
		const studentCount = await getSchoolData(school);
		schoolData[school.name] = {
			id: school.id,
			studentCount,
		};
	});

	await Promise.all(schoolPromises);

	return schoolData;
}

async function getSchoolData(school: Schools): Promise<number> {
	let studentCount = 0;

	await axios
		.get(
			`https://api.skolverket.se/planned-educations/v4/school-units/${school.schoolUnitCode}/statistics/gy`,
		)
		.then(
			(response: {
				data: { body: { totalNumberOfPupils: UnitsResponsePartial[] } };
			}) => {
				const data = response.data.body
					?.totalNumberOfPupils[0] as UnitsResponsePartial;
				if (data.valueType !== "EXISTS") return;
				const numericValue = parseInt(data.value.replace(/\D/g, ""), 10);
				studentCount = Number.isNaN(numericValue) ? 0 : numericValue;
			},
		)
		.catch((error) => {
			console.error("Error fetching schooldata:", error);
		});

	if (school.medieGymnasietSchoolUnitCode) {
		await axios
			.get(
				`https://api.skolverket.se/planned-educations/v4/school-units/${school.medieGymnasietSchoolUnitCode}/statistics/gy`,
			)
			.then(
				(response: {
					data: { body: { totalNumberOfPupils: UnitsResponsePartial[] } };
				}) => {
					const data = response.data.body
						?.totalNumberOfPupils[0] as UnitsResponsePartial;
					if (data.valueType !== "EXISTS") return;
					const value = data.value;
					const numericValue = parseInt(value.replace(/\D/g, ""), 10);
					studentCount += Number.isNaN(numericValue) ? 0 : numericValue;
				},
			)
			.catch((error) => {
				console.error("Error fetching schooldata:", error);
			});
	}

	return studentCount;
}
export default repeating;
