const { mainMenuKeyboard } = require('../keyboards/mainMenu');
const { formatRupiah } = require('../utils/formatter');
const userService = require('../services/userService');
const logger = require('../utils/logger');

async function handleStart(bot, msg) {
  try {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const username = msg.from.username || null;
    const name = msg.from.first_name || 'User';

    const user = await userService.findOrCreateUser(telegramId, username, name);

    const text = `\u{1F3EA} Panel Shop
\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}
\u{1F44B} Selamat datang, ${user.name || user.telegram_id}!

\u{1F4CB} Informasi Akun
  \u{1F194} ID : \`${user.telegram_id}\`
  \u{1F517} Username : @${user.username || '-'}
  \u{1F4B0} Saldo : ${formatRupiah(user.balance)}
\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}
Silakan pilih layanan:`;

    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: mainMenuKeyboard(),
    });
  } catch (error) {
    logger.error('Error in handleStart:', error);
  }
}

async function handleHome(bot, chatId, messageId, user) {
  try {
    const text = `\u{1F3EA} Panel Shop
\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}
\u{1F44B} Selamat datang, ${user.name || user.telegram_id}!

\u{1F4CB} Informasi Akun
  \u{1F194} ID : \`${user.telegram_id}\`
  \u{1F517} Username : @${user.username || '-'}
  \u{1F4B0} Saldo : ${formatRupiah(user.balance)}
\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}
Silakan pilih layanan:`;

    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: mainMenuKeyboard(),
    });
  } catch (error) {
    logger.error('Error in handleHome:', error);
  }
}

async function handleHelp(bot, chatId, messageId) {
  const text = `\u{1F4DE} Bantuan

Bot ini menjual akun panel Pterodactyl dan VPS DigitalOcean.

Cara penggunaan:
1. Pilih \u{1F6D2} Beli Panel atau \u{1F5A5} Beli VPS
2. Pilih paket yang tersedia
3. Lakukan pembayaran via QRIS
4. Akun/kredensial akan dikirim otomatis

Jika ada kendala, hubungi admin.`;

  await bot.editMessageText(text, {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: {
      inline_keyboard: [
        [{ text: '\u{1F519} Kembali', callback_data: 'home' }],
      ],
    },
  });
}

module.exports = { handleStart, handleHome, handleHelp };
