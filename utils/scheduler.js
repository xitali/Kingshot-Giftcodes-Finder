import { verifyGiftCode, syncCodesFromWebsite } from './giftcodes.js';

/**
 * Klasa do planowania automatycznej weryfikacji kodów promocyjnych
 */
export class CodeVerificationScheduler {
  /**
   * Tworzy nowy scheduler
   * @param {Client} client - Klient Discord
   * @param {number} interval - Interwał sprawdzania w milisekundach (domyślnie co 6 godzin)
   */
  constructor(client, interval = 6 * 60 * 60 * 1000) {
    this.client = client;
    this.interval = interval;
    this.timer = null;
  }

  /**
   * Rozpoczyna planowanie weryfikacji
   */
  start() {
    // Natychmiastowe pierwsze sprawdzenie
    this.verifyAllGuilds();
    
    // Ustawienie interwału
    this.timer = setInterval(() => this.verifyAllGuilds(), this.interval);
    console.log(`Scheduler uruchomiony. Weryfikacja kodów co ${this.interval / (60 * 60 * 1000)} godzin`);
  }

  /**
   * Zatrzymuje planowanie weryfikacji
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('Scheduler zatrzymany');
    }
  }

  /**
   * Weryfikuje kody na wszystkich skonfigurowanych serwerach
   * i synchronizuje nowe kody z witryny
   */
  async verifyAllGuilds() {
    console.log('Rozpoczęto automatyczną weryfikację i synchronizację kodów...');
    
    for (const [guildId, settings] of this.client.guildSettings.entries()) {
      if (!settings.channelId) continue;
      
      try {
        const guild = await this.client.guilds.fetch(guildId).catch(() => null);
        if (!guild) continue;
        
        const channel = await guild.channels.fetch(settings.channelId).catch(() => null);
        if (!channel) continue;
        
        await this.verifyCodesInChannel(channel);
        
        // Aktualizacja czasu ostatniego sprawdzenia
        settings.lastCheck = new Date().toISOString();
        this.client.guildSettings.set(guildId, settings);
      } catch (error) {
        console.error(`Błąd podczas weryfikacji kodów dla serwera ${guildId}:`, error);
      }
    }
    
    // Synchronizacja nowych kodów z witryny
    try {
      console.log('Rozpoczęto synchronizację kodów z witryny...');
      const syncResult = await syncCodesFromWebsite();
      
      if (syncResult.success) {
        console.log(`Synchronizacja zakończona: ${syncResult.added || 0} nowych kodów dodanych`);
        
        // Jeśli znaleziono nowe kody, publikujemy je na wszystkich skonfigurowanych kanałach
        if (syncResult.added > 0 && syncResult.newCodes) {
          await this.publishNewCodes(syncResult.newCodes);
        }
      } else {
        console.log(`Synchronizacja nieudana: ${syncResult.reason || 'Nieznany błąd'}`);
      }
    } catch (error) {
      console.error('Błąd podczas synchronizacji kodów:', error);
    }
    
    console.log('Automatyczna weryfikacja i synchronizacja kodów zakończona');
  }

  /**
   * Publikuje nowe kody na wszystkich skonfigurowanych kanałach
   * @param {Array} newCodes - Tablica nowych kodów do opublikowania
   */
  async publishNewCodes(newCodes) {
    if (!newCodes || newCodes.length === 0) return;
    
    console.log(`Publikowanie ${newCodes.length} nowych kodów na skonfigurowanych kanałach...`);
    
    for (const [guildId, settings] of this.client.guildSettings.entries()) {
      if (!settings.channelId) continue;
      
      try {
        const guild = await this.client.guilds.fetch(guildId).catch(() => null);
        if (!guild) continue;
        
        const channel = await guild.channels.fetch(settings.channelId).catch(() => null);
        if (!channel) continue;
        
        // Publikowanie każdego nowego kodu
        for (const codeData of newCodes) {
          const embed = {
            color: 0x00ff00,
            title: `Kod promocyjny: ${codeData.code}`,
            description: codeData.description || 'Kod promocyjny do gry Kingshot',
            fields: [
              {
                name: 'Nagrody',
                value: codeData.rewards || 'Różne nagrody w grze',
                inline: true
              },
              {
                name: 'Ważny do',
                value: new Date(codeData.validUntil).toLocaleDateString(),
                inline: true
              }
            ],
            timestamp: new Date(),
            footer: {
              text: 'Automatycznie zsynchronizowano z witryny'
            }
          };
          
          await channel.send({ embeds: [embed] }).catch(error => {
            console.error(`Nie można wysłać wiadomości na kanał ${channel.id}:`, error);
          });
          
          // Krótkie opóźnienie między wiadomościami
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log(`Opublikowano ${newCodes.length} kodów na kanale ${channel.name} (${guild.name})`);
      } catch (error) {
        console.error(`Błąd podczas publikowania kodów dla serwera ${guildId}:`, error);
      }
    }
  }

  /**
   * Weryfikuje kody na określonym kanale
   * @param {TextChannel} channel - Kanał do weryfikacji
   */
  async verifyCodesInChannel(channel) {
    try {
      // Pobieranie ostatnich wiadomości z kanału
      const messages = await channel.messages.fetch({ limit: 100 });
      let expiredCount = 0;
      
      for (const message of messages.values()) {
        // Sprawdzanie tylko wiadomości wysłanych przez bota z embedami
        if (message.author.id === this.client.user.id && message.embeds.length > 0) {
          const embed = message.embeds[0];
          const titleMatch = embed.title?.match(/Kod promocyjny: ([\w\d]+)/);
          
          if (titleMatch && titleMatch[1]) {
            const code = titleMatch[1];
            const verification = await verifyGiftCode(code);
            
            if (!verification.valid) {
              // Usuwanie wygasłych kodów
              await message.delete().catch(error => {
                console.error(`Nie można usunąć wiadomości: ${error}`);
              });
              expiredCount++;
            }
          }
        }
      }
      
      console.log(`Kanał ${channel.name} (${channel.guild.name}): usunięto ${expiredCount} wygasłych kodów`);
    } catch (error) {
      console.error(`Błąd podczas weryfikacji kodów na kanale ${channel.id}:`, error);
    }
  }
}