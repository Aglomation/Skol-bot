import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { updateProfileValue} from '../../utils/profileManager.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Verify'),

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        if (interaction.channel?.id != "1498834244854878209") return;

        await interaction.deferReply({ 
            ephemeral: true 
        });

        const randomnum = generateNaiveRandomString(4)
        updateProfileValue(interaction.user?.id, "verifycode", randomnum)

        // add the numbers to list with user id
        await interaction.editReply({
            content:`Your code is: **${randomnum}**\nPlease enter the code in the form below\nhttps://forms.gle/b6UgMMjASMrhhRZ3A`
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