import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { findUserByValue, getValue } from '../../utils/profileManager.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('whois')
        .setDescription('UserID -> Email -> UserID')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to check')
                .setRequired(false),
        )
        .addStringOption(option =>
            option.setName('email')
                .setDescription('Email to check')
                .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        await interaction.deferReply({ 
            ephemeral: true 
        });

        const user = interaction.options.getUser('user', true);
        const email = interaction.options.getString('email');

        if (user){
            const result = getValue(user.id, "email")

            await interaction.editReply({
                content:result || `This user doesn't seem to have an email verified.`
            })
            return
        }
        if (email){
            const result = findUserByValue("email", email)

            await interaction.editReply({
                content:`<@${result}>` || `No user seems to match the email "${email}"`
            })
            return
        }
        // add the numbers to list with user id
        await interaction.editReply({
            content:`You need to fill in atleast one of the options!`
        })
    },
};

function generateNaiveRandomString(length:number) {
  const chars = 'abcdefghijklmnpqrstuvwxyz123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    // Generate a random index between 0 and 61
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars[randomIndex];
  }
  return result;
}

export default command;