const userService = require('../services/userService');
const { broadcastConfirmKeyboard } = require('../keyboards/adminMenu');
const logger = require('../utils/logger');

async function handleBroadcastInit(bot, chatId, messageId) {
  const text = `\u{1F4E2} Broadcast Pesan

Kirim pesan yang ingin di-broadcast ke semua user.

Pesan akan di-copy persis ke setiap user (support semua media).`;

  await bot.editMessageText(text, {
    chat_id: chatId, message_id: messageId,
    reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Batal', callback_data: 'admin_broadcast_cancel' }]] },
  });
}

async function handleBroadcastConfirm(bot, chatId, fromChatId, msgId) {
  const total = await userService.countActiveUsers();
  const text = `\u{1F4E2} Konfirmasi Broadcast

Pesan akan di-copy persis seperti yang dikirim.

\u{1F465} Total penerima: ${total} user aktif

Kirim sekarang?`;

  await bot.sendMessage(chatId, text, {
    reply_markup: broadcastConfirmKeyboard(),
  });
}

async function handleBroadcastStart(bot, adminChatId, messageId, fromChatId, msgId) {
  const users = await userService.getAllActiveTelegramIds();
  const total = users.length;
  let sent = 0;
  let failed = 0;

  await bot.editMessageText(
    `\u{1F4E2} Mengirim broadcast...\n0 / ${total}`,
    { chat_id: adminChatId, message_id: messageId }
  );

  for (let i = 0; i < total; i++) {
    try {
      await bot._request('copyMessage', { form: {
        chat_id: parseInt(users[i].telegram_id),
        from_chat_id: fromChatId,
        message_id: msgId,
      } });
      sent++;
    } catch (error) {
      failed++;
      logger.warn(`Broadcast gagal ke user ${users[i].telegram_id}: ${error.message}`);
    }
    if ((i + 1) % 10 === 0 || i === total - 1) {
      await bot.editMessageText(
        `\u{1F4E2} Mengirim broadcast...\n${i + 1} / ${total} (terkirim: ${sent}, gagal: ${failed})`,
        { chat_id: adminChatId, message_id: messageId }
      );
    }
  }

  await bot.editMessageText(
    `\u{2705} Broadcast selesai!\n\n\u{2705} Terkirim: ${sent}\n\u{274C} Gagal: ${failed}\n\u{1F465} Total: ${total}`,
    {
      chat_id: adminChatId, message_id: messageId,
      reply_markup: { inline_keyboard: [[{ text: '\u{1F6E1} Kembali ke Admin', callback_data: 'admin' }]] },
    }
  );
}

module.exports = {
  handleBroadcastInit, handleBroadcastConfirm, handleBroadcastStart,
};
