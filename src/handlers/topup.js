const QRCode = require('qrcode');
const { Transaction, User } = require('../models');
const { topupPaymentKeyboard } = require('../keyboards/productMenu');
const { formatRupiah, generateInvoice } = require('../utils/formatter');
const paymentService = require('../services/paymentService');
const userService = require('../services/userService');
const logger = require('../utils/logger');

async function handleTopupInit(bot, chatId, messageId) {
  await bot.editMessageText('\u{1F4B0} Top Up Saldo\n\nMasukkan jumlah saldo yang ingin ditambahkan (minimal Rp1.000):', {
    chat_id: chatId, message_id: messageId,
    reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Batal', callback_data: 'home' }]] },
  });
}

async function handleTopupAmount(bot, chatId, telegramId, amount, userId) {
  try {
    if (isNaN(amount) || amount < 1000) {
      await bot.sendMessage(chatId, '\u{274C} Minimal top up Rp1.000. Silakan coba lagi.');
      return;
    }

    const invoice = generateInvoice();

    await Transaction.create({
      invoice,
      user_id: userId,
      type: 'topup',
      price: amount,
      status: 'pending',
    });

    const payment = await paymentService.createPayment(invoice, amount);

    const qrBuffer = await QRCode.toBuffer(payment.payment_url, {
      type: 'png', width: 512, margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    const caption = `\u{1F4B0} Top Up Saldo

Invoice: ${invoice}
Jumlah: ${formatRupiah(amount)}

Scan QR di atas untuk membayar.`;

    await bot.sendPhoto(chatId, qrBuffer, {
      caption,
      reply_markup: topupPaymentKeyboard(invoice),
    });

    logger.info(`Topup created: ${invoice} for user ${telegramId}`);
  } catch (error) {
    logger.error('Error in handleTopupAmount:', error);
    await bot.sendMessage(chatId, '\u{274C} Gagal memproses top up. Silakan coba lagi.');
  }
}

async function handleTopupCheckPayment(bot, chatId, messageId, invoice) {
  try {
    const transaction = await Transaction.findOne({ where: { invoice, type: 'topup' } });

    if (!transaction) {
      await bot.editMessageText('\u{274C} Transaksi tidak ditemukan.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'home' }]] },
      });
      return;
    }

    if (transaction.status !== 'pending') {
      await bot.editMessageText(`\u{26A0} Status: ${transaction.status.toUpperCase()}\n\nInvoice: ${invoice}`, {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'home' }]] },
      });
      return;
    }

    const payment = await paymentService.checkPayment(invoice, transaction.price);

    if (payment.status !== 'completed') {
      await bot.editMessageText('\u{23F3} Pembayaran belum dikonfirmasi.\n\nSilakan scan QR dan lakukan pembayaran, lalu klik "Sudah Bayar" lagi.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: topupPaymentKeyboard(invoice),
      });
      return;
    }

    const user = await userService.getUserById(transaction.user_id);
    if (!user) {
      await bot.sendMessage(chatId, '\u{274C} User tidak ditemukan.');
      return;
    }

    await userService.addBalance(transaction.user_id, transaction.price);
    await transaction.update({ status: 'success', payment_method: 'qris', payment_ref: invoice });

    await bot.editMessageText(`\u{2705} Top up berhasil!\n\nSaldo bertambah: ${formatRupiah(transaction.price)}\nSaldo saat ini: ${formatRupiah(user.balance + transaction.price)}\nInvoice: ${invoice}`, {
      chat_id: chatId, message_id: messageId,
      reply_markup: { inline_keyboard: [[{ text: '\u{1F3E0} Menu Utama', callback_data: 'home' }]] },
    });

    logger.info(`Topup completed: ${invoice} for user ${transaction.user_id}`);
  } catch (error) {
    logger.error('Error in handleTopupCheckPayment:', error);
    await bot.sendMessage(chatId, '\u{274C} Gagal memproses top up. Hubungi admin.', {
      reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'home' }]] },
    });
  }
}

module.exports = { handleTopupInit, handleTopupAmount, handleTopupCheckPayment };
