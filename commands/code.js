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
  .setDescription('Adds a new KingShot promotional code')
  .addStringOption(option =>
    option.setName('giftcode')
      .setDescription('Promotional code to add')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('description')
      .setDescription('Description of the promotional code (optional)')
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction, client) {
  // Sprawdzenie uprawnień
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: 'You do not have permission to use this command!', flags: MessageFlags.Ephemeral });
  }

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

  // Pobranie parametrów komendy
  const giftcode = interaction.options.getString('giftcode');
  const description = interaction.options.getString('description') || '';

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    // Dodanie kodu promocyjnego
    const result = await addGiftCode(giftcode, description);

    if (!result.success) {
      return interaction.editReply(`Failed to add promotional code: ${result.reason}`);
    }

    // Utworzenie embeda z kodem promocyjnym
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`Promotional Code: ${result.code.code}`)
      .setDescription(result.code.description)
      .addFields(
        { name: 'Rewards', value: result.code.rewards },
        { name: 'Valid until', value: new Date(result.code.validUntil).toLocaleDateString('en-US') }
      )
      .setTimestamp();

    // Wysłanie kodu na skonfigurowany kanał
    await channel.send({ embeds: [embed] });

    await interaction.editReply(`Successfully added promotional code ${giftcode} and shared it on channel ${channel}.`);
  } catch (error) {
    console.error('Error adding promotional code:', error);
    await interaction.editReply('An error occurred while adding the promotional code.');
  }
}