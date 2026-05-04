import { Collection, SlashCommandBuilder, ChatInputCommandInteraction, ButtonInteraction, AutocompleteInteraction, Client } from 'discord.js';

// 1. Define the structures for your commands and components
declare global {
    interface Command {
        data: SlashCommandBuilder | { name: string; toJSON: () => any };
        execute: (interaction: ChatInputCommandInteraction, client: Client) => Promise<void>;
    }
    interface Button {
        data: { customId: string };
        execute: (interaction: ButtonInteraction, client: Client) => Promise<void>;
    }
    interface Autocomplete {
        data: { name: string };
        execute: (interaction: AutocompleteInteraction, client: Client) => Promise<void>;
    }
    interface UserProfile {
        verifycode: string;
        email: string;
        timeout: number | null;
        banned: boolean;
        banreason: string | null;
        banduration: string | null;
        birthday: { year: number; month: number; day: number } | null;
    }
}

// 2. Extend the base Discord.js Client
declare module 'discord.js' {
    export interface Client {
        commands: Collection<string, Command>;
        autocompletes: Collection<string, Autocomplete>;
        buttons: Collection<string, Button>;
        repeating: Collection<string, {
            repeating: boolean;
            time: number | null;
            exactTime: string | null;
            immediate: boolean;
            execute: (client: Client) => Promise<void>;
        }>;
        banList: Set<string>;
        saveBanlist: () => void;
        profilelist: Collection<string, UserProfile>;
        saveProfilelist: () => void;
    }
}