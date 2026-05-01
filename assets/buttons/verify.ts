import { ButtonInteraction, ChatInputCommandInteraction, Client, PermissionFlagsBits } from 'discord.js';
import { updateProfileValue, getValue } from '../../utils/profileManager.js';

const button: Button = {
    data: { name: 'verify' },
    async execute(interaction: ButtonInteraction, client: Client) {
        
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
            
            if (!member) return;

            const roleId = "1498832228145168514";

            const role = await interaction.guild?.roles.fetch(roleId).catch(() => null);

            if (!role) {
                console.warn(`Role ${roleId} not found in the guild.`);
                return;
            }

            await member.roles.add(role);
            return
        }

        const randomnum = generateRandomString(4)
        updateProfileValue(interaction.user?.id, "verifycode", randomnum)

        await interaction.editReply({
            content:`Your code is: \`${randomnum}\`\nMake sure you use your school mail!\nPlease enter the code in the form below\nhttps://forms.gle/b6UgMMjASMrhhRZ3A`
        })
    },
};

function generateRandomString(length:number) {
    // 36 ^ 4 = 1,679,616
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        result += chars[randomIndex];
    }
    return result;
}

export default button;