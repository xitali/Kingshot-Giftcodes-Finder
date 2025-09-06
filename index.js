import { Client, GatewayIntentBits, Partials, Collection, Events, MessageFlags } from 'discord.js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { CodeVerificationScheduler } from './utils/scheduler.js';
import { ReminderScheduler } from './utils/reminderScheduler.js';

// Environment variables configuration
config();

// Path settings
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Discord client initialization
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message]
});

// Collections for commands and data
client.commands = new Collection();
client.guildSettings = new Map();

// Loading commands
const commandsPath = path.join(__dirname, 'commands');
if (!fs.existsSync(commandsPath)) {
  fs.mkdirSync(commandsPath, { recursive: true });
}

const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const fileURL = pathToFileURL(filePath).href;
  const command = await import(fileURL);
  
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    console.log(`Loaded command: ${command.data.name}`);
  } else {
    console.log(`[WARNING] Command in ${filePath} does not contain required properties "data" or "execute"`);
  }
}

// Loading server settings
const settingsPath = path.join(__dirname, 'data');
if (!fs.existsSync(settingsPath)) {
  fs.mkdirSync(settingsPath, { recursive: true });
}

const settingsFile = path.join(settingsPath, 'settings.json');
if (fs.existsSync(settingsFile)) {
  try {
    const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    for (const [guildId, guildSettings] of Object.entries(settings)) {
      client.guildSettings.set(guildId, guildSettings);
    }
    console.log('Loaded server settings');
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Handling interactions (slash commands)
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`Command not found: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(error);
    
    try {
      const content = { content: 'An error occurred while executing this command!', flags: MessageFlags.Ephemeral };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(content).catch(e => console.error('Cannot send followUp:', e));
      } else {
        await interaction.reply(content).catch(e => console.error('Cannot send reply:', e));
      }
    } catch (replyError) {
      console.error('Error while trying to respond to interaction:', replyError);
    }
  }
});

// Saving settings on shutdown
process.on('SIGINT', () => saveSettings());
process.on('SIGTERM', () => saveSettings());

function saveSettings() {
  const settings = {};
  for (const [guildId, guildSettings] of client.guildSettings.entries()) {
    settings[guildId] = guildSettings;
  }
  
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  console.log('Server settings saved');
  process.exit(0);
}

// Logging into Discord
client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  // Start code verification scheduler
  const codeScheduler = new CodeVerificationScheduler(client);
  codeScheduler.start();
  client.scheduler = codeScheduler;
  
  // Start reminder scheduler
  const reminderScheduler = new ReminderScheduler(client);
  reminderScheduler.start();
  client.reminderScheduler = reminderScheduler;
});

client.login(process.env.DISCORD_TOKEN);