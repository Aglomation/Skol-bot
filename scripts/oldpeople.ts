import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from "dotenv";
import path from "path";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});
dotenv.config({ path: path.join(process.cwd(), ".env"), quiet: true });

client.once('ready', async () => {
  try {
    const TARGET_ROLE_ID = '1497140069843079223';
    const EXCLUDE_ROLE_ID = '1498832228145168514';

    // Fetch all guilds the bot is in
    const guild = client.guilds.cache.get("1497140069746741338");
    if (!guild) {
      console.error('Guild not found. Make sure the bot is in the guild.');
      return;
    }

    // Fetch all members in the guild (requires GuildMembers intent)
    const members = await guild.members.fetch();

    // Filter members: Has TARGET_ROLE_ID and DOES NOT have EXCLUDE_ROLE_ID
    const matchingMembers = members.filter(
    (member) =>
        member.roles.cache.has(TARGET_ROLE_ID) &&
        !member.roles.cache.has(EXCLUDE_ROLE_ID)
    );

    console.log(`Guild: ${guild.name} (${guild.id})`);
    console.log(`Matching Users Count: ${matchingMembers.size}\n`);

    matchingMembers.forEach((member) => {
    console.log(`- ${member.user.tag} <@${member.id}>`);
    });
  } catch (error) {
    console.error('Error fetching members:', error);
  } finally {
    console.log('\nTask complete. Closing client...');
    client.destroy();
    process.exit(0);
  }
});

client.login(process.env.TOKEN);