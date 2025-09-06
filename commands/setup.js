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
  .setDescription('Configure KingShot bot channels')
  .addSubcommand(subcommand =>
    subcommand
      .setName('codes')
      .setDescription('Set channel for promotional codes')
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('Channel where promotional codes will be shared')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('reminder')
      .setDescription('Set channel for event reminders')
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('Channel where event reminders will be sent')
          .setRequired(true)))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction, client) {
  // Check permissions
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: 'You do not have permission to use this command!', flags: MessageFlags.Ephemeral });
  }

  const subcommand = interaction.options.getSubcommand();
  
  if (subcommand === 'codes') {
    await setupCodesChannel(interaction, client);
  } else if (subcommand === 'reminder') {
    await setupReminderChannel(interaction, client);
  }
}

async function setupCodesChannel(interaction, client) {
  try {
    // Acknowledge the interaction immediately to prevent timeout
    await interaction.deferReply({ ephemeral: true });
    
    const channel = interaction.options.getChannel('channel');
    
    // Check if channel is text-based
    if (!channel.isTextBased()) {
      return interaction.editReply({ content: 'Selected channel must be a text channel!' });
    }

    // Check if bot has permissions to send messages in this channel
    const permissions = channel.permissionsFor(interaction.client.user);
    if (!permissions.has(PermissionFlagsBits.SendMessages) || !permissions.has(PermissionFlagsBits.ViewChannel)) {
      return interaction.editReply({ 
        content: 'Bot does not have sufficient permissions to send messages in this channel!'
      });
    }
    
    // Save settings for the server
    const guildId = interaction.guild.id;
    console.log(`setupCodesChannel - Guild ID: ${guildId}`);
    console.log(`setupCodesChannel - Channel ID: ${channel.id}`);
    console.log(`setupCodesChannel - Guild name: ${interaction.guild.name}`);
    
    const settings = client.guildSettings.get(guildId) || {};
    console.log(`setupCodesChannel - Current settings for guild:`, settings);
    
    settings.channelId = channel.id;
    settings.lastCheck = new Date().toISOString();

    console.log(`setupCodesChannel - Updated settings:`, settings);
    client.guildSettings.set(guildId, settings);
    console.log(`setupCodesChannel - Settings set in client.guildSettings`);

    // Save settings to file
    console.log(`setupCodesChannel - Calling saveSettings with guildId: ${guildId}`);
    saveSettings(guildId, settings);

    await interaction.editReply({ 
      content: `Successfully configured ${channel} for sharing KingShot promotional codes!`
    });
    console.log(`setupCodesChannel - Setup completed successfully for guild ${guildId}`);
  } catch (error) {
    console.error('Error in setupCodesChannel:', error);
    try {
      await interaction.editReply({ 
        content: 'An error occurred while setting up the codes channel. Please try again later.'
      });
    } catch (replyError) {
      console.error('Failed to send error response:', replyError);
    }
  }
}

async function setupReminderChannel(interaction, client) {
  try {
    // Acknowledge the interaction immediately to prevent timeout
    await interaction.deferReply({ ephemeral: true });
    
    const channel = interaction.options.getChannel('channel');
    
    // Check if channel is text-based
    if (!channel.isTextBased()) {
      return interaction.editReply({ content: 'Selected channel must be a text channel!' });
    }

    // Check if bot has permissions to send messages in this channel
    const permissions = channel.permissionsFor(interaction.client.user);
    if (!permissions.has(PermissionFlagsBits.SendMessages) || !permissions.has(PermissionFlagsBits.ViewChannel)) {
      return interaction.editReply({ 
        content: 'Bot does not have sufficient permissions to send messages in this channel!'
      });
    }

    // Save settings for the server
    const guildId = interaction.guild.id;
    const settings = client.guildSettings.get(guildId) || {};
    
    settings.reminderChannelId = channel.id;

    client.guildSettings.set(guildId, settings);

    // Save settings to file
    saveSettings(guildId, settings);

    await interaction.editReply({ 
      content: `Successfully configured ${channel} for KingShot event reminders!`
    });
  } catch (error) {
    console.error('Error in setupReminderChannel:', error);
    try {
      await interaction.editReply({ 
        content: 'An error occurred while setting up the reminder channel. Please try again later.'
      });
    } catch (replyError) {
      console.error('Failed to send error response:', replyError);
    }
  }
}

function saveSettings(guildId, settings) {
  const settingsPath = path.join(dataPath, 'settings.json');
  let allSettings = {};
  
  console.log(`Saving settings for guild ID: ${guildId}`);
  console.log(`Settings to save:`, JSON.stringify(settings, null, 2));
  
  if (fs.existsSync(settingsPath)) {
    try {
      const fileContent = fs.readFileSync(settingsPath, 'utf8');
      console.log(`Current settings file content: ${fileContent}`);
      if (fileContent.trim()) {
        allSettings = JSON.parse(fileContent);
        console.log(`Parsed existing settings:`, JSON.stringify(allSettings, null, 2));
      }
    } catch (error) {
      console.error('Error reading settings file:', error);
      // Create a backup of the corrupted file
      const backupPath = `${settingsPath}.backup.${Date.now()}`;
      try {
        fs.copyFileSync(settingsPath, backupPath);
        console.log(`Created backup of corrupted settings file at ${backupPath}`);
      } catch (backupError) {
        console.error('Failed to create backup of corrupted settings file:', backupError);
      }
    }
  }

  allSettings[guildId] = settings;
  console.log(`Updated settings to save:`, JSON.stringify(allSettings, null, 2));
  
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(allSettings, null, 2));
    console.log(`Settings successfully saved to ${settingsPath}`);
  } catch (error) {
    console.error('Error writing settings file:', error);
    throw new Error('Failed to save settings. Please try again later.');
  }
}