import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { addGiftCode } from '../utils/giftcodes.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.join(__dirname, '..', 'data');

export const data = new SlashCommandBuilder()
  .setName('code')
  .setDescription('Dodaje nowy kod promocyjny Kingshot')
  .addStringOption(option =>
    option.setName('giftcode')
      .setDescription('Kod promocyjny do dodania')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('description')
      .setDescription('Opis kodu promocyjnego (opcjonalnie)')
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction, client) {
  // Sprawdzenie uprawnień
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: 'Nie masz uprawnień do użycia tej komendy!', flags: MessageFlags.Ephemeral });
  }

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

  // Pobranie parametrów komendy
  const giftcode = interaction.options.getString('giftcode');
  const description = interaction.options.getString('description') || '';

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    // Dodanie kodu promocyjnego
    const result = await addGiftCode(giftcode, description);

    if (!result.success) {
      return interaction.editReply(`Nie udało się dodać kodu promocyjnego: ${result.reason}`);
    }

    // Utworzenie embeda z kodem promocyjnym
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`Kod promocyjny: ${result.code.code}`)
      .setDescription(result.code.description)
      .addFields(
        { name: 'Nagrody', value: result.code.rewards },
        { name: 'Ważny do', value: new Date(result.code.validUntil).toLocaleDateString() }
      )
      .setTimestamp();

    // Wysłanie kodu na skonfigurowany kanał
    await channel.send({ embeds: [embed] });

    await interaction.editReply(`Pomyślnie dodano kod promocyjny ${giftcode} i udostępniono go na kanale ${channel}.`);
  } catch (error) {
    console.error('Błąd podczas dodawania kodu promocyjnego:', error);
    await interaction.editReply('Wystąpił błąd podczas dodawania kodu promocyjnego.');
  }
}