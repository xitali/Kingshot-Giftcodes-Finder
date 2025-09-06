import { EmbedBuilder } from 'discord.js';

/**
 * Class for scheduling and managing reminders
 */
export class ReminderScheduler {
  /**
   * Creates a new reminder scheduler
   * @param {Client} client - Discord client
   */
  constructor(client) {
    this.client = client;
    this.bearTrapTimers = new Map();
    this.arenaTimer = null;
  }

  /**
   * Starts all scheduled reminders
   */
  start() {
    // Schedule Arena reminder at 23:30 UTC daily
    this.scheduleArenaReminder();
    
    // Schedule any existing Bear Trap reminders from settings
    this.scheduleSavedBearTrapReminders();
    
    console.log('Reminder scheduler started');
  }

  /**
   * Stops all scheduled reminders
   */
  stop() {
    // Clear Arena reminder
    if (this.arenaTimer) {
      clearTimeout(this.arenaTimer);
      this.arenaTimer = null;
    }
    
    // Clear all Bear Trap reminders
    for (const [guildId, timer] of this.bearTrapTimers.entries()) {
      clearTimeout(timer);
    }
    this.bearTrapTimers.clear();
    
    console.log('Reminder scheduler stopped');
  }

  /**
   * Schedules the daily Arena reminder at 23:30 UTC
   */
  scheduleArenaReminder() {
    // Clear existing timer if any
    if (this.arenaTimer) {
      clearTimeout(this.arenaTimer);
    }
    
    // Calculate time until next 23:30 UTC
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
    
    const timeUntilReminder = nextReminder.getTime() - now.getTime();
    
    // Schedule the reminder
    this.arenaTimer = setTimeout(() => {
      this.sendArenaReminder();
      // Reschedule for next day
      this.scheduleArenaReminder();
    }, timeUntilReminder);
    
    console.log(`Arena reminder scheduled for ${nextReminder.toISOString()} (in ${Math.floor(timeUntilReminder / 60000)} minutes)`);
  }

  /**
   * Sends the Arena reminder to all configured reminder channels
   */
  async sendArenaReminder() {
    console.log('Sending Arena battle reminders...');
    
    for (const [guildId, settings] of this.client.guildSettings.entries()) {
      // Skip if reminder channel is not configured or arena reminders are disabled
      if (!settings.reminderChannelId || settings.arenaRemindersEnabled === false) continue;
      
      try {
        const guild = await this.client.guilds.fetch(guildId).catch(() => null);
        if (!guild) continue;
        
        const channel = await guild.channels.fetch(settings.reminderChannelId).catch(() => null);
        if (!channel) continue;
        
        // Calculate time until next reminder (24 hours)
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
        
        const embed = new EmbedBuilder()
          .setColor('#FF9900')
          .setTitle('Arena Battle Reminder')
          .setDescription('The Arena is waiting for brave warriors! Don\'t forget to participate in Arena battles!')
          .addFields(
            { name: 'Next Reminder', value: `In ${timeUntilText} (daily at 23:30 UTC)` }
          )
          .setFooter({ text: 'KingShot Reminder' });
        
        await channel.send({ embeds: [embed] }).catch(error => {
          console.error(`Cannot send Arena reminder to channel ${channel.id}:`, error);
        });
        
        console.log(`Arena reminder sent to ${channel.name} (${guild.name})`);
        console.log(`Next Arena reminder for guild ${guildId} will be on ${nextReminder.toISOString()} (in ${timeUntilText})`);
      } catch (error) {
        console.error(`Error sending Arena reminder for server ${guildId}:`, error);
      }
    }
  }

  /**
   * Schedules Bear Trap reminders from saved settings
   */
  scheduleSavedBearTrapReminders() {
    for (const [guildId, settings] of this.client.guildSettings.entries()) {
      if (settings.bearTrapTime) {
        // When loading from saved settings, always use 'today' to calculate the next occurrence
        this.scheduleBearTrapReminder(guildId, settings.bearTrapTime, 'today');
      }
    }
  }

  /**
   * Schedules a Bear Trap reminder for a specific guild
   * @param {string} guildId - The guild ID
   * @param {string} timeString - The time in HH:MM format (UTC)
   * @param {string} startFrom - When to start the reminder ('today' or 'tomorrow')
   * @returns {Object} Result of the scheduling operation
   */
  scheduleBearTrapReminder(guildId, timeString, startFrom = 'today') {
    // Clear existing timer if any
    if (this.bearTrapTimers.has(guildId)) {
      clearTimeout(this.bearTrapTimers.get(guildId));
    }
    
    // Parse the time string (HH:MM format)
    const [hours, minutes] = timeString.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return { success: false, reason: 'Invalid time format. Please use HH:MM in 24-hour format.' };
    }
    
    // Calculate time until next reminder
    const now = new Date();
    const nextReminder = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      hours, minutes, 0, 0
    ));
    
    // Adjust the date based on startFrom parameter
    if (startFrom === 'tomorrow' || (startFrom === 'today' && now >= nextReminder)) {
      nextReminder.setUTCDate(nextReminder.getUTCDate() + 1);
    }
    
    const timeUntilReminder = nextReminder.getTime() - now.getTime();
    
    // Schedule the reminder
    const timer = setTimeout(() => {
      this.sendBearTrapReminder(guildId);
      
      // Get the interval setting (default to 2 days)
      const settings = this.client.guildSettings.get(guildId) || {};
      const interval = settings.bearTrapInterval || 2; // Default to 2 days if not specified
      
      // Calculate the next reminder date (interval days from now)
      const nextDate = new Date();
      nextDate.setUTCDate(nextDate.getUTCDate() + interval);
      const nextReminder = new Date(Date.UTC(
        nextDate.getUTCFullYear(),
        nextDate.getUTCMonth(),
        nextDate.getUTCDate(),
        hours, minutes, 0, 0
      ));
      
      const timeUntilNextReminder = nextReminder.getTime() - new Date().getTime();
      
      // Schedule the next reminder directly with setTimeout
      const nextTimer = setTimeout(() => {
        this.sendBearTrapReminder(guildId);
        // Continue the cycle by scheduling the next reminder
        this.scheduleBearTrapReminder(guildId, timeString, 'today');
      }, timeUntilNextReminder);
      
      this.bearTrapTimers.set(guildId, nextTimer);
      
      console.log(`Next Bear Trap reminder for guild ${guildId} scheduled for ${nextReminder.toISOString()} (in ${Math.floor(timeUntilNextReminder / 60000)} minutes)`);
    }, timeUntilReminder);
    
    this.bearTrapTimers.set(guildId, timer);
    
    console.log(`Bear Trap reminder for guild ${guildId} scheduled for ${nextReminder.toISOString()} (in ${Math.floor(timeUntilReminder / 60000)} minutes)`);
    
    return { 
      success: true, 
      nextReminder: nextReminder.toISOString(),
      timeUntilMinutes: Math.floor(timeUntilReminder / 60000)
    };
  }

  /**
   * Sends a Bear Trap reminder to a specific guild
   * @param {string} guildId - The guild ID
   */
  async sendBearTrapReminder(guildId) {
    const settings = this.client.guildSettings.get(guildId);
    if (!settings || !settings.reminderChannelId) return;
    
    try {
      const guild = await this.client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return;
      
      const channel = await guild.channels.fetch(settings.reminderChannelId).catch(() => null);
      if (!channel) return;
      
      // Calculate next reminder date (2 days from now)
      const now = new Date();
      const nextDate = new Date(now);
      const interval = settings.bearTrapInterval || 2; // Default to 2 days if not specified
      nextDate.setUTCDate(nextDate.getUTCDate() + interval); // Add interval days
      
      // Calculate time until next reminder in hours and minutes
      const timeUntilNextMs = nextDate.getTime() - now.getTime();
      const timeUntilHours = Math.floor(timeUntilNextMs / (60 * 60 * 1000));
      const timeUntilMinutesRemainder = Math.floor((timeUntilNextMs % (60 * 60 * 1000)) / (60 * 1000));
      const timeUntilText = `${timeUntilHours}h ${timeUntilMinutesRemainder}min`;
      
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('Bear Trap Reminder')
        .setDescription('The Bear Trap event is starting soon! Prepare for battle and don\'t miss your chance for great rewards!')
        .addFields(
          { name: 'Next Reminder', value: `In ${timeUntilText} (every ${interval} days)` }
        )
        .setFooter({ text: 'KingShot Reminder' });
      
      await channel.send({ embeds: [embed] }).catch(error => {
        console.error(`Cannot send Bear Trap reminder to channel ${channel.id}:`, error);
      });
      
      console.log(`Bear Trap reminder sent to ${channel.name} (${guild.name})`);
      console.log(`Next Bear Trap reminder for guild ${guildId} will be on ${nextDate.toISOString()} (in ${timeUntilText})`);
    } catch (error) {
      console.error(`Error sending Bear Trap reminder for server ${guildId}:`, error);
    }
  }
}