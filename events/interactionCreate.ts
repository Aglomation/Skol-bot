import { Interaction, Client, Events } from 'discord.js';

export default {
    name: Events.InteractionCreate,
    once: false,
    async execute(interaction: Interaction, client: Client) {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction, client);
            } catch (error) {
                console.error(error);
            }

        } else if (interaction.isAutocomplete()) {
            const autocompleteCommand = client.autocompletes.get(interaction.commandName);
            if (!autocompleteCommand) return;

            try {
                await autocompleteCommand.execute(interaction, client);
            } catch (error) {
                console.error(error);
            }

        } else if (interaction.isButton()) {
            const buttonCommand = client.buttons.get(interaction.customId);
            if (!buttonCommand) return;

            try {
                await buttonCommand.execute(interaction, client);
            } catch (error) {
                console.error(error);
            }
        }
    },
};