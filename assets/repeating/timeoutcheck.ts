import { Client } from 'discord.js';
import 'dotenv/config';
import { getProfile } from '../../utils/profileManager.js';
const repeating = {
    repeating: true,
    time: 1 * 60 * 60 * 1000,
    immediate: true,

    async execute(client: Client) {
        const guild = await client.guilds.fetch(process.env.GUILD_ID!)
        const members = await guild.members.fetch();

        if (!members) return;

        const timedOutMembers = members.filter(member => member.isCommunicationDisabled());

        console.log(`Found ${timedOutMembers.size} users currently on timeout.`);

        timedOutMembers.forEach(member => {
            const timeLeft = getProfile(member.id)?.timeout;
            if (!timeLeft) return;

            console.log(`- ${member.user.tag} (Unmuted at: ${member.communicationDisabledUntil})`);

            // Refreshes the timeout 
            member.timeout(Math.min(timeLeft, Date.now() +28 * 24 * 60 * 60 * 1000))
            .catch(err => {
                console.error(`Failed to refresh timeout for ${member.user.tag}:`, err);
            });
        });

        return timedOutMembers;
    },
};

export default repeating;