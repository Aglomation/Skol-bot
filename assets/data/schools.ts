interface Schools {
    schoolUnitCode: number;
    name: string;
    id: string;
    medieGymnasietSchoolUnitCode?: number;
};

const SchoolList: Schools[] = [
    {
        name: "Borås",
        id: "1497160597220098148",
        schoolUnitCode: 86888278
    },
    {
        name: "Göteborg",
        id: "1497160590647623690",
        schoolUnitCode: 53231578,
        medieGymnasietSchoolUnitCode: 97382366
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
        schoolUnitCode: 18594470
    },
    {
        name: "Kungsbacka",
        id: "1497142971643072545",
        schoolUnitCode: 86888278
    },
    {
        name: "Linköping",
        id: "1497142969726271538",
        schoolUnitCode: 86787111
    },
    {
        name: "Lund",
        id: "1497149407169089536",
        schoolUnitCode: 51449748
    },
    {
        name: "Malmö",
        id: "1497142975552290888",
        schoolUnitCode: 97931189
    },
    {
        name: "Nyköping",
        id: "1497140788864225360",
        schoolUnitCode: 44285075
    },
    {
        name: "Stockholm Norra",
        id: "1497160592056647750",
        schoolUnitCode: 18106851
    },
    {
        name: "Stockholm Södra",
        id: "1497142976835747840",
        schoolUnitCode: 46256929
    },
    {
        name: "Trollhättan",
        id: "1497160595823263804",
        schoolUnitCode: 21400668
    },
    {
        name: "Växjö",
        id: "1497160595085066340",
        schoolUnitCode: 17083056
    },
    {
        name: "Örebro",
        id: "1497160592866283631",
        schoolUnitCode: 94207720
    },
];

export default SchoolList;