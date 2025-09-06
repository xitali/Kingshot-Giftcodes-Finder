import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { searchGiftCodes, verifyGiftCode, syncCodesFromWebsite } from '../utils/giftcodes.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.join(__dirname, '..', 'data');

export const data = new SlashCommandBuilder()
  .setName('codes')
  .setDescription('Zarządza kodami promocyjnymi Kingshot')
  .addSubcommand(subcommand =>
    subcommand
      .setName('search')
      .setDescription('Wyszukuje i udostępnia aktywne kody promocyjne'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('verify')
      .setDescription('Weryfikuje ważność kodów promocyjnych na kanale'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('sync')
      .setDescription('Synchronizuje kody promocyjne ze strony axeetech.com'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction, client) {
  // Sprawdzenie uprawnień
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
    return interaction.reply({ content: 'Nie masz uprawnień do użycia tej komendy!', flags: MessageFlags.Ephemeral });
  }

  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  const guildSettings = client.guildSettings.get(guildId);

  // Sprawdzenie czy kanał został skonfigurowany
  if (!guildSettings || !guildSettings.channelId) {
    return interaction.reply({ 
      content: 'Najpierw skonfiguruj kanał do udostępniania kodów używając komendy `/setup`!', 
      flags: MessageFlags.Ephemeral 
    });
  }

  const channelId = guildSettings.channelId;
  const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);

  if (!channel) {
    return interaction.reply({ 
      content: 'Skonfigurowany kanał nie istnieje! Użyj komendy `/setup` aby skonfigurować nowy kanał.', 
      flags: MessageFlags.Ephemeral 
    });
  }

  // Sprawdzenie czy bot ma uprawnienia do wysyłania wiadomości na tym kanale
  const permissions = channel.permissionsFor(interaction.client.user);
  if (!permissions.has(PermissionFlagsBits.SendMessages) || !permissions.has(PermissionFlagsBits.ViewChannel)) {
    return interaction.reply({ 
      content: 'Bot nie ma wystarczających uprawnień do wysyłania wiadomości na skonfigurowanym kanale!', 
      flags: MessageFlags.Ephemeral 
    });
  }

  if (subcommand === 'search') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    try {
      const codes = await searchGiftCodes();
      const validCodes = codes.filter(code => new Date(code.validUntil) > new Date());
      
      if (validCodes.length === 0) {
        return interaction.editReply('Nie znaleziono aktywnych kodów promocyjnych.');
      }
      
      // Wysyłanie kodów na skonfigurowany kanał
      for (const code of validCodes) {
        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle(`Kod promocyjny: ${code.code}`)
          .setDescription(code.description)
          .addFields(
            { name: 'Nagrody', value: code.rewards },
            { name: 'Ważny do', value: new Date(code.validUntil).toLocaleDateString() }
          )
          .setTimestamp();
        
        await channel.send({ embeds: [embed] });
      }
      
      await interaction.editReply(`Pomyślnie udostępniono ${validCodes.length} aktywnych kodów promocyjnych na kanale ${channel}.`);
    } catch (error) {
      console.error('Błąd podczas wyszukiwania kodów:', error);
      await interaction.editReply('Wystąpił błąd podczas wyszukiwania kodów promocyjnych.');
    }
  } else if (subcommand === 'verify') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    try {
      // Pobieranie ostatnich wiadomości z kanału
      const messages = await channel.messages.fetch({ limit: 100 });
      let verifiedCount = 0;
      let expiredCount = 0;
      
      for (const message of messages.values()) {
        // Sprawdzanie tylko wiadomości wysłanych przez bota z embedami
        if (message.author.id === client.user.id && message.embeds.length > 0) {
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
            } else {
              verifiedCount++;
            }
          }
        }
      }
      
      await interaction.editReply(`Weryfikacja zakończona. Zweryfikowano ${verifiedCount} aktywnych kodów, usunięto ${expiredCount} wygasłych kodów.`);
    } catch (error) {
      console.error('Błąd podczas weryfikacji kodów:', error);
      await interaction.editReply('Wystąpił błąd podczas weryfikacji kodów promocyjnych.');
    }
  } else if (subcommand === 'sync') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    try {
      const result = await syncCodesFromWebsite();
      
      if (!result.success) {
        return interaction.editReply(`Nie udało się zsynchronizować kodów: ${result.reason}`);
      }
      
      if (result.added === 0) {
        return interaction.editReply(result.message);
      }
      
      // Wysyłanie nowych kodów na skonfigurowany kanał
      for (const code of result.newCodes) {
        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle(`Kod promocyjny: ${code.code}`)
          .setDescription(code.description)
          .addFields(
            { name: 'Nagrody', value: code.rewards },
            { name: 'Ważny do', value: new Date(code.validUntil).toLocaleDateString() }
          )
          .setFooter({ text: 'Kod pobrany ze strony axeetech.com' })
          .setTimestamp();
        
        await channel.send({ embeds: [embed] });
      }
      
      await interaction.editReply(`${result.message}. Kody zostały opublikowane na kanale ${channel}.`);
    } catch (error) {
      console.error('Błąd podczas synchronizacji kodów:', error);
      await interaction.editReply('Wystąpił błąd podczas synchronizacji kodów promocyjnych.');
    }
  }
}