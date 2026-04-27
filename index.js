const fs = require('fs');
const { Client, Collection, GatewayIntentBits } = require('discord.js')
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
require('dotenv/config');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ],
})

client.commands = new Collection();
// client.autocompletes = new Collection();
client.buttons = new Collection();

const BAN_FILE = "./storage/bans.json";

function loadBanlist() {
    try {
        const data = fs.readFileSync(BAN_FILE);
        return new Set(JSON.parse(data));
    } catch {
        return new Set();
    }
}

function saveBanlist(banlist) {
    fs.writeFileSync(BAN_FILE, JSON.stringify([...banlist], null, 4));
}

// load into client
client.banList = loadBanlist();
client.saveBanlist = () => saveBanlist(client.banList);

const commandFiles = fs.readdirSync('./assets/commands').filter(file => file.endsWith('.js'));
// const autocompleteFiles = fs.readdirSync('./assets/autocompletes').filter(file => file.endsWith('.js'));
const buttonFiles = fs.readdirSync('./assets/buttons').filter(file => file.endsWith('.js'));

// Load commands from files
const commands = [];
for (const file of commandFiles) {
  const command = require(`./assets/commands/${file}`);
  client.commands.set(command.data.name, command);
  commands.push(command.data.toJSON());
}

// for (const file of autocompleteFiles) {
//   const autocomplete = require(`./assets/autocompletes/${file}`);
//   client.autocompletes.set(autocomplete.data.name, autocomplete);
// }

for (const file of buttonFiles) {
  const buttons = require(`./assets/buttons/${file}`);
  client.buttons.set(buttons.data.name, buttons);
}

// Register commands with Discord
const rest = new REST({ version: '10' }).setToken(process.env.token);
(async () => {
    try {
      console.log('Started reloaded application (/) commands.');

      await rest.put(
        Routes.applicationCommands(process.env.clientId),{ body: commands },
      );

      console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
      console.error(error);
    }
})();

// Event handlers
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('interactionCreate', async interaction => {
  if (interaction.isCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction,client);
      } catch (error) {
        console.error(error);
      }

  } else if (interaction.isAutocomplete()) {
      const commandName = interaction.commandName;
      const autocompleteCommand = client.autocompletes.get(commandName);
      if (!autocompleteCommand) return;

      try {
        await autocompleteCommand.execute(interaction,client);
      } catch (error) {
        console.error(error);
      }

  } else if (interaction.isButton()) {
      const customId = interaction.customId;
      const buttonCommand = client.buttons.get(customId);
      if (!buttonCommand) return;

      try {
        await buttonCommand.execute(interaction,client);
      } catch (error) {
        console.error(error);
      }

  }
});

client.on('guildMemberAdd', async (member) => {
    if (client.banList.has(member.id)) {
        try {
            await member.kick('User is softbanned');
            console.log(`Kicked ${member.user.tag} (softban list)`);
        } catch (err) {
            console.log(`Failed to kick ${member.user.tag}:`, err.message);
        }
    } else {
      // --- Welcome embed ---
      const channel = await client.channels.fetch('1497140071176863756')
      if (!channel) return;

      const embed = {
          title: "Välkommen",
          description: `Välkommen ${member} till ${member.guild.name}!\nGå in i <id:customize> för att skaffa en custom färg.`,
          color: 0x2b2d31,
          thumbnail: {
              url: member.user.displayAvatarURL({ dynamic: true })
          },
          footer: {
              text: `${member.guild.members.cache.filter(m => !m.user.bot).size} Medlemmar : ${new Date().toLocaleString()}`
          }
      };

      channel.send({ embeds: [embed] });
    }
});

client.login(process.env.token);
