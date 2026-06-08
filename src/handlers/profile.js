const { User, Transaction, Product } = require('../models');
const { formatRupiah, formatDate } = require('../utils/formatter');
const logger = require('../utils/logger');

async function handleProfile(bot, chatId, messageId, userId) {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      await bot.editMessageText('\u{274C} User tidak ditemukan.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'home' }]] },
      });
      return;
    }

    const purchaseCount = await Transaction.count({
      where: { user_id: userId, status: 'success' },
    });

    const text = `\u{1F464} Profil

ID Telegram: ${user.telegram_id}
Username: ${user.username || '-'}
Saldo: ${formatRupiah(user.balance)}
Jumlah Pembelian: ${purchaseCount}
Tanggal Bergabung: ${formatDate(user.created_at)}`;

    await bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          [{ text: '\u{1F4DC} Riwayat Transaksi', callback_data: 'history_0' }],
          [{ text: '\u{1F519} Kembali', callback_data: 'home' }],
        ],
      },
    });
  } catch (error) {
    logger.error('Error in handleProfile:', error);
  }
}

async function handleHistory(bot, chatId, messageId, userId, page = 0) {
  try {
    const limit = 5;
    const { rows, count } = await Transaction.findAndCountAll({
      where: { user_id: userId },
      include: [Product],
      order: [['created_at', 'DESC']],
      offset: page * limit,
      limit,
    });

    const totalPages = Math.ceil(count / limit);

    if (rows.length === 0) {
      await bot.editMessageText('\u{1F4DC} Belum ada transaksi.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'profile' }]] },
      });
      return;
    }

    let text = `\u{1F4DC} Riwayat Transaksi (Halaman ${page + 1}/${totalPages})\n\n`;
    for (const t of rows) {
      const productName = t.Product ? t.Product.name : 'Unknown';
      text += `${t.invoice}\n\u{1F4E6} ${productName}\n\u{1F4B0} ${formatRupiah(t.price)}\n\u{2139} ${t.status.toUpperCase()}\n\u{1F4C5} ${formatDate(t.created_at)}\n\n`;
    }

    const navRow = [];
    if (page > 0) navRow.push({ text: '\u{2B05}', callback_data: `history_${page - 1}` });
    if (page < totalPages - 1) navRow.push({ text: '\u{27A1}', callback_data: `history_${page + 1}` });

    const keyboard = { inline_keyboard: [] };
    if (navRow.length) keyboard.inline_keyboard.push(navRow);
    keyboard.inline_keyboard.push([{ text: '\u{1F519} Kembali', callback_data: 'profile' }]);

    await bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error('Error in handleHistory:', error);
  }
}

module.exports = { handleProfile, handleHistory };
