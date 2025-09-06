import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.join(__dirname, '..', 'data');

if (!fs.existsSync(dataPath)) {
  fs.mkdirSync(dataPath, { recursive: true });
}

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Konfiguruje kanał do udostępniania kodów promocyjnych Kingshot')
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('Kanał, na którym będą udostępniane kody promocyjne')
      .setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction, client) {
  // Sprawdzenie uprawnień
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: 'Nie masz uprawnień do użycia tej komendy!', flags: MessageFlags.Ephemeral });
  }

  const channel = interaction.options.getChannel('channel');
  
  // Sprawdzenie czy kanał jest kanałem tekstowym
  if (!channel.isTextBased()) {
    return interaction.reply({ content: 'Wybrany kanał musi być kanałem tekstowym!', flags: MessageFlags.Ephemeral });
  }

  // Sprawdzenie czy bot ma uprawnienia do wysyłania wiadomości na tym kanale
  try {
    const permissions = channel.permissionsFor(interaction.client.user);
    if (!permissions.has(PermissionFlagsBits.SendMessages) || !permissions.has(PermissionFlagsBits.ViewChannel)) {
      return interaction.reply({ 
        content: 'Bot nie ma wystarczających uprawnień do wysyłania wiadomości na tym kanale!', 
        flags: MessageFlags.Ephemeral 
      });
    }
  } catch (error) {
    console.error('Błąd podczas sprawdzania uprawnień:', error);
    return interaction.reply({ 
      content: 'Wystąpił błąd podczas sprawdzania uprawnień bota dla wybranego kanału.', 
      flags: MessageFlags.Ephemeral 
    });
  }

  // Zapisanie ustawień dla serwera
  const guildId = interaction.guild.id;
  const settings = {
    channelId: channel.id,
    lastCheck: new Date().toISOString()
  };

  client.guildSettings.set(guildId, settings);

  // Zapisanie ustawień do pliku
  const settingsPath = path.join(dataPath, 'settings.json');
  let allSettings = {};
  
  if (fs.existsSync(settingsPath)) {
    try {
      allSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (error) {
      console.error('Błąd podczas odczytu pliku ustawień:', error);
    }
  }

  allSettings[guildId] = settings;
  fs.writeFileSync(settingsPath, JSON.stringify(allSettings, null, 2));

  await interaction.reply({ 
    content: `Pomyślnie skonfigurowano kanał ${channel} do udostępniania kodów promocyjnych Kingshot!`, 
    flags: MessageFlags.Ephemeral 
  });
}