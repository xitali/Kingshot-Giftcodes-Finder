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
  .setDescription('Manages KingShot promotional codes')
  .addSubcommand(subcommand =>
    subcommand
      .setName('search')
      .setDescription('Searches and shares active promotional codes'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('verify')
      .setDescription('Verifies the validity of promotional codes on the channel'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('sync')
      .setDescription('Synchronizes promotional codes from axeetech.com'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction, client) {
  // Sprawdzenie uprawnień
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
    return interaction.reply({ content: 'You do not have permission to use this command!', flags: MessageFlags.Ephemeral });
  }

  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  const guildSettings = client.guildSettings.get(guildId);

  // Sprawdzenie czy kanał został skonfigurowany
  if (!guildSettings || !guildSettings.channelId) {
    return interaction.reply({ 
      content: 'First configure a channel for sharing codes using the `/setup` command!', 
      flags: MessageFlags.Ephemeral 
    });
  }

  const channelId = guildSettings.channelId;
  const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);

  if (!channel) {
    return interaction.reply({ 
      content: 'The configured channel does not exist! Use the `/setup` command to configure a new channel.', 
      flags: MessageFlags.Ephemeral 
    });
  }

  // Sprawdzenie czy bot ma uprawnienia do wysyłania wiadomości na tym kanale
  const permissions = channel.permissionsFor(interaction.client.user);
  if (!permissions.has(PermissionFlagsBits.SendMessages) || !permissions.has(PermissionFlagsBits.ViewChannel)) {
    return interaction.reply({ 
      content: 'The bot does not have sufficient permissions to send messages on the configured channel!', 
      flags: MessageFlags.Ephemeral 
    });
  }

  if (subcommand === 'search') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    try {
      const codes = await searchGiftCodes();
      const validCodes = codes.filter(code => new Date(code.validUntil) > new Date());
      
      if (validCodes.length === 0) {
        return interaction.editReply('No active promotional codes found.');
      }
      
      // Wysyłanie kodów na skonfigurowany kanał
      for (const code of validCodes) {
        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle(`Promotional Code: ${code.code}`)
          .setDescription(code.description)
          .addFields(
            { name: 'Rewards', value: code.rewards },
            { name: 'Valid until', value: new Date(code.validUntil).toLocaleDateString('en-US') }
          )
          .setTimestamp();
        
        await channel.send({ embeds: [embed] });
      }
      
      await interaction.editReply(`Successfully shared ${validCodes.length} active promotional codes on channel ${channel}.`);
    } catch (error) {
      console.error('Error searching for codes:', error);
      await interaction.editReply('An error occurred while searching for promotional codes.');
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
          const titleMatch = embed.title?.match(/Promotional Code: ([\w\d]+)/);
          
          if (titleMatch && titleMatch[1]) {
            const code = titleMatch[1];
            const verification = await verifyGiftCode(code);
            
            if (!verification.valid) {
              // Usuwanie wygasłych kodów
              await message.delete().catch(error => {
                console.error(`Cannot delete message: ${error}`);
              });
              expiredCount++;
            } else {
              verifiedCount++;
            }
          }
        }
      }
      
      await interaction.editReply(`Verification completed. Verified ${verifiedCount} active codes, removed ${expiredCount} expired codes.`);
    } catch (error) {
      console.error('Error verifying codes:', error);
      await interaction.editReply('An error occurred while verifying promotional codes.');
    }
  } else if (subcommand === 'sync') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    try {
      const result = await syncCodesFromWebsite();
      
      if (!result.success) {
        return interaction.editReply(`Failed to synchronize codes: ${result.reason}`);
      }
      
      if (result.added === 0) {
        return interaction.editReply(result.message);
      }
      
      // Wysyłanie nowych kodów na skonfigurowany kanał
      for (const code of result.newCodes) {
        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle(`Promotional Code: ${code.code}`)
          .setDescription(code.description)
          .addFields(
            { name: 'Rewards', value: code.rewards },
            { name: 'Valid until', value: new Date(code.validUntil).toLocaleDateString('en-US') }
          )
          .setFooter({ text: 'Code retrieved from axeetech.com' });
        
        await channel.send({ embeds: [embed] });
      }
      
      await interaction.editReply(`${result.message}. Codes have been published on channel ${channel}.`);
    } catch (error) {
      console.error('Error synchronizing codes:', error);
      await interaction.editReply('An error occurred while synchronizing promotional codes.');
    }
  }
}