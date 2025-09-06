import { Client, GatewayIntentBits, Partials, Collection, Events, MessageFlags } from 'discord.js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { CodeVerificationScheduler } from './utils/scheduler.js';

// Konfiguracja zmiennych środowiskowych
config();

// Ustawienia ścieżek
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicjalizacja klienta Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message]
});

// Kolekcje dla komend i danych
client.commands = new Collection();
client.guildSettings = new Map();

// Ładowanie komend
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
    console.log(`Załadowano komendę: ${command.data.name}`);
  } else {
    console.log(`[UWAGA] Komenda w ${filePath} nie zawiera wymaganych właściwości "data" lub "execute"`);
  }
}

// Ładowanie ustawień serwera
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
    console.log('Załadowano ustawienia serwerów');
  } catch (error) {
    console.error('Błąd podczas ładowania ustawień:', error);
  }
}

// Obsługa interakcji (komendy slash)
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`Nie znaleziono komendy ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(error);
    const content = { content: 'Wystąpił błąd podczas wykonywania tej komendy!', flags: MessageFlags.Ephemeral };
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(content);
    } else {
      await interaction.reply(content);
    }
  }
});

// Zapisywanie ustawień przy zamknięciu
process.on('SIGINT', () => saveSettings());
process.on('SIGTERM', () => saveSettings());

function saveSettings() {
  const settings = {};
  for (const [guildId, guildSettings] of client.guildSettings.entries()) {
    settings[guildId] = guildSettings;
  }
  
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  console.log('Zapisano ustawienia serwerów');
  process.exit(0);
}

// Logowanie do Discord
client.once(Events.ClientReady, () => {
  console.log(`Zalogowano jako ${client.user.tag}`);
  
  // Uruchomienie schedulera weryfikacji kodów
  const scheduler = new CodeVerificationScheduler(client);
  scheduler.start();
  client.scheduler = scheduler;
});

client.login(process.env.DISCORD_TOKEN);