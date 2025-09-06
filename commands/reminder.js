import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.join(__dirname, '..', 'data');

export const data = new SlashCommandBuilder()
  .setName('reminder')
  .setDescription('Configure reminders for KingShot events')
  .addSubcommand(subcommand =>
    subcommand
      .setName('beartrap')
      .setDescription('Set a reminder for Bear Trap event (UTC time)')
      .addIntegerOption(option =>
        option.setName('hour')
          .setDescription('Hour in 24-hour format (UTC timezone)')
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(23))
      .addStringOption(option =>
        option.setName('start_from')
          .setDescription('When to start the reminder')
          .setRequired(true)
          .addChoices(
            { name: 'Today', value: 'today' },
            { name: 'Tomorrow', value: 'tomorrow' }
          )))
  .addSubcommand(subcommand =>
    subcommand
      .setName('arena')
      .setDescription('Enable or disable daily Arena battle reminders at 23:30 UTC')
      .addBooleanOption(option =>
        option.setName('enabled')
          .setDescription('Enable or disable Arena reminders')
          .setRequired(true)))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction, client) {
  // Check permissions
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: 'You do not have permission to use this command!', flags: MessageFlags.Ephemeral });
  }

  const subcommand = interaction.options.getSubcommand();
  
  if (subcommand === 'beartrap') {
    await handleBearTrapReminder(interaction, client);
  } else if (subcommand === 'arena') {
    await handleArenaReminder(interaction, client);
  }
}

async function handleBearTrapReminder(interaction, client) {
  const hour = interaction.options.getInteger('hour');
  const startFrom = interaction.options.getString('start_from');
  
  // Validate hour
  if (hour < 0 || hour > 23) {
    return interaction.reply({ 
      content: 'Invalid hour. Please use a value between 0 and 23.', 
      flags: MessageFlags.Ephemeral 
    });
  }
  
  // Check if reminder channel is configured
  const guildId = interaction.guild.id;
  const settings = client.guildSettings.get(guildId) || {};
  
  if (!settings.reminderChannelId) {
    return interaction.reply({ 
      content: 'No reminder channel configured. Please use `/setup reminder` first.', 
      flags: MessageFlags.Ephemeral 
    });
  }
  
  try {
    // Format time string (HH:00)
    const timeString = `${hour.toString().padStart(2, '0')}:00`;
    
    // Update settings
    settings.bearTrapTime = timeString;
    settings.bearTrapInterval = 2; // Set interval to 2 days
    client.guildSettings.set(guildId, settings);
    
    // Save settings to file
    const settingsPath = path.join(dataPath, 'settings.json');
    let allSettings = {};
    
    if (fs.existsSync(settingsPath)) {
      try {
        allSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      } catch (error) {
        console.error('Error reading settings file:', error);
      }
    }
    
    allSettings[guildId] = settings;
    fs.writeFileSync(settingsPath, JSON.stringify(allSettings, null, 2));
    
    // Schedule the reminder
    if (client.reminderScheduler) {
      const result = client.reminderScheduler.scheduleBearTrapReminder(guildId, timeString, startFrom);
      
      if (result.success) {
        // Calculate time until next reminder in hours and minutes
        const timeUntilHours = Math.floor(result.timeUntilMinutes / 60);
        const timeUntilMinutesRemainder = result.timeUntilMinutes % 60;
        const timeUntilText = `${timeUntilHours}h ${timeUntilMinutesRemainder}min`;
        
        // Send immediate notification to the reminder channel
        try {
          const channel = await interaction.guild.channels.fetch(settings.reminderChannelId);
          if (channel && channel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setColor('#FF0000')
              .setTitle('Bear Trap Reminder Setup')
              .setDescription(`Bear Trap reminder has been set by an administrator!`)
              .addFields(
                { name: 'Next Reminder', value: `In ${timeUntilText} (at ${hour}:00 UTC)` },
                { name: 'Frequency', value: `Every 2 days` }
              )
              .setFooter({ text: 'KingShot Reminder' });
            
            await channel.send({ embeds: [embed] });
          }
        } catch (error) {
          console.error('Error sending immediate Bear Trap notification:', error);
        }
        
        await interaction.reply({ 
          content: `Bear Trap reminder successfully set for ${hour}:00 UTC every 2 days, starting from ${startFrom}. Time until next reminder: ${timeUntilText}.`, 
          flags: MessageFlags.Ephemeral 
        });
      } else {
        await interaction.reply({ 
          content: `Failed to set Bear Trap reminder: ${result.reason}`, 
          flags: MessageFlags.Ephemeral 
        });
      }
    } else {
      await interaction.reply({ 
        content: 'Reminder scheduler is not initialized. Please contact the bot administrator.', 
        flags: MessageFlags.Ephemeral 
      });
    }
  } catch (error) {
    console.error('Error setting Bear Trap reminder:', error);
    await interaction.reply({ 
      content: 'An error occurred while setting the Bear Trap reminder.', 
      flags: MessageFlags.Ephemeral 
    });
  }
}

async function handleArenaReminder(interaction, client) {
  const enabled = interaction.options.getBoolean('enabled');
  
  // Check if reminder channel is configured
  const guildId = interaction.guild.id;
  const settings = client.guildSettings.get(guildId) || {};
  
  if (!settings.reminderChannelId) {
    return interaction.reply({ 
      content: 'No reminder channel configured. Please use `/setup reminder` first.', 
      flags: MessageFlags.Ephemeral 
    });
  }
  
  try {
    // Update settings
    settings.arenaRemindersEnabled = enabled;
    client.guildSettings.set(guildId, settings);
    
    // Save settings to file
    const settingsPath = path.join(dataPath, 'settings.json');
    let allSettings = {};
    
    if (fs.existsSync(settingsPath)) {
      try {
        allSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      } catch (error) {
        console.error('Error reading settings file:', error);
      }
    }
    
    allSettings[guildId] = settings;
    fs.writeFileSync(settingsPath, JSON.stringify(allSettings, null, 2));
    
    // Calculate time until next reminder
    const now = new Date();
    const nextReminder = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      23, 30, 0, 0
    ));
    
    // If it's already past 23:30 UTC today, schedule for tomorrow
    if (now >= nextReminder) {
      nextReminder.setUTCDate(nextReminder.getUTCDate() + 1);
    }
    
    const timeUntilNextMs = nextReminder.getTime() - now.getTime();
    const timeUntilHours = Math.floor(timeUntilNextMs / (60 * 60 * 1000));
    const timeUntilMinutesRemainder = Math.floor((timeUntilNextMs % (60 * 60 * 1000)) / (60 * 1000));
    const timeUntilText = `${timeUntilHours}h ${timeUntilMinutesRemainder}min`;
    
    // Send immediate notification to the reminder channel
    try {
      const channel = await interaction.guild.channels.fetch(settings.reminderChannelId);
      if (channel && channel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setColor('#FF9900')
          .setTitle('Arena Battle Reminder Setup')
          .setDescription(`Arena battle reminders have been ${enabled ? 'enabled' : 'disabled'} by an administrator!`)
          .setFooter({ text: 'KingShot Reminder' });
        
        if (enabled) {
          embed.addFields(
            { name: 'Next Reminder', value: `In ${timeUntilText} (daily at 23:30 UTC)` }
          );
        }
        
        await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error sending immediate Arena notification:', error);
    }
    
    if (enabled) {
      await interaction.reply({ 
        content: `Arena battle reminders have been enabled. Reminders will be sent daily at 23:30 UTC. Time until next reminder: ${timeUntilText}.`, 
        flags: MessageFlags.Ephemeral 
      });
    } else {
      await interaction.reply({ 
        content: `Arena battle reminders have been disabled.`, 
        flags: MessageFlags.Ephemeral 
      });
    }
  } catch (error) {
    console.error('Error configuring Arena reminders:', error);
    await interaction.reply({ 
      content: 'An error occurred while configuring Arena reminders.', 
      flags: MessageFlags.Ephemeral 
    });
  }
}