import fs from "node:fs";

const PROFILE_FILE = "./storage/profiles.json";

export type ProfileList = Record<string, UserProfile>;
