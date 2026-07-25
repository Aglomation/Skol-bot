import type { AutocompleteInteraction, ButtonInteraction, ChatInputCommandInteraction, Client, Interaction } from "discord.js";
import { Events, MessageFlags } from "discord.js";

export default {
	name: Events.InteractionCreate,
	once: false,
	async execute(interaction: Interaction, client: Client) {
		if (interaction.isChatInputCommand()) {
			await handleChatInputCommand(interaction, client)
			return;
		}

		if (interaction.isAutocomplete()) {
			await handleAutocomplete(interaction, client);
			return;
		}
		
		if (interaction.isButton()) {
			await handleButton(interaction, client);
		}
	},
};


async function handleChatInputCommand(interaction: ChatInputCommandInteraction, client: Client) {
	const command = client.commands.get(interaction.commandName);
    
    if (!command) {
        console.warn(`[Warning] No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction, client);
    } catch (error) {
        console.error(`[Error] Executing command ${interaction.commandName}:`, error);

        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ content: 'There was an error while executing this command!' }).catch(() => null);
        } else {
            await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral }).catch(() => null);
        }
    }
}

async function handleAutocomplete(interaction: AutocompleteInteraction, client: Client) {
    const standaloneAutocomplete = client.autocompletes.get(interaction.commandName);
    
    if (standaloneAutocomplete) {
        try {
            await standaloneAutocomplete.execute(interaction, client);
        } catch (error) {
            console.error(`[Error] Executing standalone autocomplete for ${interaction.commandName}:`, error);
        }
        return;
    }

    // Check the command file for autocomplete handler if no file found
    const command = client.commands.get(interaction.commandName);
    if (!command || typeof command.autocomplete !== "function") return;

    try {
        await command.autocomplete(interaction, client);
    } catch (error) {
        console.error(`[Error] Executing command autocomplete for ${interaction.commandName}:`, error);
    }
}

async function handleButton(interaction: ButtonInteraction, client: Client) {
	const customId = interaction.customId.includes(":")
		? interaction.customId.split(":")[0]
		: interaction.customId;

	const buttonCommand = client.buttons.get(customId);

	if (!buttonCommand){
		console.warn(`[Warning] No button handler found for ${customId}.`);
		return;
	}

	try {
		await buttonCommand.execute(interaction, client);
	} catch (error) {
		console.error(`[Error] Executing button ${customId}:`, error);
	}
}