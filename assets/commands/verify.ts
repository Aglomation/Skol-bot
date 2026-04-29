import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits } from 'discord.js';
import { updateProfileValue, getValue } from '../../utils/profileManager.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Verify your email via Google Forms')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        
        if (interaction.channel?.id != "1498834244854878209") return;

        await interaction.deferReply({ 
            ephemeral: true 
        });
        if (getValue(interaction.user.id, "email") !== null){
            await interaction.editReply({
                content:`You already have an email connected.`
            })
            // Fetch member using the ID as a string, catching potential errors if they left
            const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
            
            // Check if the member exists BEFORE trying to modify them
            if (!member) return;

            const roleId = "1498832228145168514";

            const role = await interaction.guild?.roles.fetch(roleId).catch(() => null);

            if (!role) {
                console.warn(`Role ${roleId} not found in the guild.`);
                return;
            }

            await member.roles.add(role);
        }

        const randomnum = generateNaiveRandomString(4)
        updateProfileValue(interaction.user?.id, "verifycode", randomnum)

        // add the numbers to list with user id
        await interaction.editReply({
            content:`Your code is: \`**${randomnum}**\`\nPlease enter the code in the form below\nhttps://forms.gle/b6UgMMjASMrhhRZ3A`
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