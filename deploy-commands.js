import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';

// Konfiguracja zmiennych środowiskowych
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const fileURL = pathToFileURL(filePath).href;
  const command = await import(fileURL);
  
  if ('data' in command) {
    commands.push(command.data.toJSON());
  } else {
    console.log(`[UWAGA] Komenda w ${filePath} nie zawiera wymaganej właściwości "data"`);
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Rozpoczęto odświeżanie ${commands.length} komend aplikacji (/).`);

    // Rejestracja komend globalnie
    const data = await rest.put(
      Routes.applicationCommands(process.env.APPLICATION_ID),
      { body: commands },
    );

    console.log(`Pomyślnie odświeżono ${data.length} komend aplikacji (/).`);
  } catch (error) {
    console.error(error);
  }
})();