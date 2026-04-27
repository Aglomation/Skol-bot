import fs from 'fs';

const BAN_FILE = "./storage/bans.json";

export const loadBanlist = (): Set<string> => {
    try {
        const data = fs.readFileSync(BAN_FILE, 'utf-8');
        return new Set<string>(JSON.parse(data));
    } catch {
        return new Set<string>();
    }
};

export const saveBanlist = (banlist: Set<string>): void => {
    fs.writeFileSync(BAN_FILE, JSON.stringify([...banlist], null, 4));
};