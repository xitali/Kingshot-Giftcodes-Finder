import { verifyGiftCode, syncCodesFromWebsite } from './giftcodes.js';

/**
 * Class for scheduling automatic verification of promotional codes
 */
export class CodeVerificationScheduler {
  /**
   * Creates a new scheduler
   * @param {Client} client - Discord client
   * @param {number} interval - Check interval in milliseconds (default: every 6 hours)
   */
  constructor(client, interval = 6 * 60 * 60 * 1000) {
    this.client = client;
    this.interval = interval;
    this.timer = null;
  }

  /**
   * Starts verification scheduling
   */
  start() {
    // Immediate first check
    this.verifyAllGuilds();
    
    // Set interval
    this.timer = setInterval(() => this.verifyAllGuilds(), this.interval);
    console.log(`Scheduler started. Code verification every ${this.interval / (60 * 60 * 1000)} hours`);
  }

  /**
   * Stops verification scheduling
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('Scheduler stopped');
    }
  }

  /**
   * Verifies codes on all configured servers
   * and synchronizes new codes from the website
   */
  async verifyAllGuilds() {
    console.log('Started automatic code verification and synchronization...');
    
    for (const [guildId, settings] of this.client.guildSettings.entries()) {
      if (!settings.channelId) continue;
      
      try {
        const guild = await this.client.guilds.fetch(guildId).catch(() => null);
        if (!guild) continue;
        
        const channel = await guild.channels.fetch(settings.channelId).catch(() => null);
        if (!channel) continue;
        
        await this.verifyCodesInChannel(channel);
        
        // Update last check time
        settings.lastCheck = new Date().toISOString();
        this.client.guildSettings.set(guildId, settings);
      } catch (error) {
        console.error(`Error verifying codes for server ${guildId}:`, error);
      }
    }
    
    // Synchronization of new codes from website
    try {
      console.log('Started synchronizing codes from website...');
      const syncResult = await syncCodesFromWebsite();
      
      if (syncResult.success) {
        console.log(`Synchronization completed: ${syncResult.added || 0} new codes added`);
        
        // If new codes were found, publish them on all configured channels
        if (syncResult.added > 0 && syncResult.newCodes) {
          await this.publishNewCodes(syncResult.newCodes);
        }
      } else {
        console.log(`Synchronization failed: ${syncResult.reason || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error synchronizing codes:', error);
    }
    
    console.log('Automatic code verification and synchronization completed');
  }

  /**
   * Publishes new codes on all configured channels
   * @param {Array} newCodes - Array of new codes to publish
   */
  async publishNewCodes(newCodes) {
    if (!newCodes || newCodes.length === 0) return;
    
    console.log(`Publishing ${newCodes.length} new codes on configured channels...`);
    
    for (const [guildId, settings] of this.client.guildSettings.entries()) {
      if (!settings.channelId) continue;
      
      try {
        const guild = await this.client.guilds.fetch(guildId).catch(() => null);
        if (!guild) continue;
        
        const channel = await guild.channels.fetch(settings.channelId).catch(() => null);
        if (!channel) continue;
        
        // Publishing each new code
        for (const codeData of newCodes) {
          const embed = {
            color: 0x00ff00,
            title: `Promotional Code: ${codeData.code}`,
            description: codeData.description || 'KingShot promotional code',
            fields: [
              {
                name: 'Rewards',
                value: codeData.rewards || 'Various in-game rewards',
                inline: true
              },
              {
                name: 'Valid until',
                value: new Date(codeData.validUntil).toLocaleDateString('en-US'),
                inline: true
              }
            ],
            timestamp: new Date(),
            footer: {
              text: 'Automatically synchronized from website'
            }
          };
          
          await channel.send({ embeds: [embed] }).catch(error => {
            console.error(`Cannot send message to channel ${channel.id}:`, error);
          });
          
          // Short delay between messages
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log(`Published ${newCodes.length} codes on channel ${channel.name} (${guild.name})`);
      } catch (error) {
        console.error(`Error publishing codes for server ${guildId}:`, error);
      }
    }
  }

  /**
   * Verifies codes on a specific channel
   * @param {TextChannel} channel - Channel to verify
   */
  async verifyCodesInChannel(channel) {
    try {
      // Fetching recent messages from the channel
      const messages = await channel.messages.fetch({ limit: 100 });
      let expiredCount = 0;
      
      for (const message of messages.values()) {
        // Checking only messages sent by the bot with embeds
        if (message.author.id === this.client.user.id && message.embeds.length > 0) {
          const embed = message.embeds[0];
          const titleMatch = embed.title?.match(/Promotional Code: ([\w\d]+)/);
          
          if (titleMatch && titleMatch[1]) {
            const code = titleMatch[1];
            const verification = await verifyGiftCode(code);
            
            if (!verification.valid) {
              // Removing expired codes
              await message.delete().catch(error => {
                console.error(`Cannot delete message: ${error}`);
              });
              expiredCount++;
            }
          }
        }
      }
      
      console.log(`Channel ${channel.name} (${channel.guild.name}): removed ${expiredCount} expired codes`);
    } catch (error) {
      console.error(`Error verifying codes on channel ${channel.id}:`, error);
    }
  }
}