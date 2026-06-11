const QRCode = require('qrcode');
const { Product, Transaction, User } = require('../models');
const { paymentMethodKeyboard, paymentQrKeyboard } = require('../keyboards/productMenu');
const { formatRupiah, formatDate, generateInvoice, generatePassword } = require('../utils/formatter');
const paymentService = require('../services/paymentService');
const pterodactylService = require('../services/pterodactylService');
const userService = require('../services/userService');
const logger = require('../utils/logger');

async function handleBuy(bot, chatId, messageId, productId, userId) {
  try {
    const product = await Product.findByPk(productId);
    if (!product) {
      await bot.editMessageText('\u{274C} Produk tidak ditemukan.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'products' }]] },
      });
      return;
    }

    const user = await userService.getUserById(userId);
    if (!user || user.is_banned) {
      await bot.editMessageText('\u{274C} Akun Anda telah dibanned.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'home' }]] },
      });
      return;
    }

    const text = `\u{1F4E6} ${product.name}
Harga: ${formatRupiah(product.price)}
Saldo kamu: ${formatRupiah(user.balance)}

Pilih metode pembayaran:`;

    await bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      reply_markup: await paymentMethodKeyboard(productId),
    });
  } catch (error) {
    logger.error('Error in handleBuy:', error);
  }
}

async function handleBuyWithQris(bot, chatId, messageId, productId, userId) {
  try {
    const product = await Product.findByPk(productId);
    if (!product) {
      await bot.editMessageText('\u{274C} Produk tidak ditemukan.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'products' }]] },
      });
      return;
    }

    const user = await userService.getUserById(userId);
    if (!user || user.is_banned) {
      await bot.editMessageText('\u{274C} Akun Anda telah dibanned.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'home' }]] },
      });
      return;
    }

    await bot.editMessageText('\u{23F3} Menyiapkan pembayaran...', {
      chat_id: chatId, message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    });

    const invoice = generateInvoice();

    await Transaction.create({
      invoice,
      user_id: userId,
      product_id: product.id,
      price: product.price,
      status: 'pending',
    });

    const payment = await paymentService.createPayment(invoice, product.price);

    const qrBuffer = await QRCode.toBuffer(payment.payment_url, {
      type: 'png', width: 512, margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    const caption = `\u{1F4B3} Pembayaran QRIS

Produk: ${product.name}
Invoice: ${invoice}
Total: ${formatRupiah(product.price)}

Scan QR di atas untuk membayar.`;

    await bot.sendPhoto(chatId, qrBuffer, {
      caption,
      reply_markup: paymentQrKeyboard(invoice),
    });

    logger.info(`Payment created: ${invoice} for user ${user.id}`);
  } catch (error) {
    logger.error('Error in handleBuyWithQris:', error);
    await bot.sendMessage(chatId, '\u{274C} Gagal membuat pembayaran. Silakan coba lagi.');
  }
}

async function handleBuyWithBalance(bot, chatId, messageId, productId, userId) {
  try {
    const product = await Product.findByPk(productId);
    if (!product) {
      await bot.editMessageText('\u{274C} Produk tidak ditemukan.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'products' }]] },
      });
      return;
    }

    const user = await userService.getUserById(userId);
    if (!user || user.is_banned) {
      await bot.editMessageText('\u{274C} Akun Anda telah dibanned.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'home' }]] },
      });
      return;
    }

    if (user.balance < product.price) {
      await bot.editMessageText(`\u{274C} Saldo tidak mencukupi.

Saldo kamu: ${formatRupiah(user.balance)}
Harga: ${formatRupiah(product.price)}
Kekurangan: ${formatRupiah(product.price - user.balance)}

Silakan top up saldo terlebih dahulu.`, {
        chat_id: chatId, message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [{ text: '\u{1F4B0} Top Up', callback_data: 'topup' }],
            [{ text: '\u{1F519} Kembali', callback_data: 'products' }],
          ],
        },
      });
      return;
    }

    await bot.editMessageText('\u{23F3} Memproses pembayaran...', {
      chat_id: chatId, message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    });

    const invoice = generateInvoice();

    await userService.subtractBalance(userId, product.price);

    const transaction = await Transaction.create({
      invoice,
      user_id: userId,
      product_id: product.id,
      price: product.price,
      status: 'paid',
      payment_method: 'balance',
    });

    await createPanelServer(bot, chatId, transaction, user, product, invoice);
  } catch (error) {
    logger.error('Error in handleBuyWithBalance:', error);
    await bot.sendMessage(chatId, '\u{274C} Gagal memproses pembayaran. Silakan hubungi admin.', {
      reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'home' }]] },
    });
  }
}

async function createPanelServer(bot, chatId, transaction, user, product, invoice) {
  const email = `${user.username || 'user'}@telegram`;
  const password = generatePassword();
  const username = `panel_${user.id}_${Date.now()}`;

  const pterodactylUser = await pterodactylService.createPterodactylUser(email, username, password);

  const server = await pterodactylService.createPterodactylServer(pterodactylUser.id, product);

  const expiresAt = new Date(Date.now() + (product.duration_days || 30) * 24 * 60 * 60 * 1000);
  const expiredText = formatDate(expiresAt);

  await transaction.update({
    status: 'success',
    server_id: server.id,
    expires_at: expiresAt,
  });

  const panelUrl = process.env.PTERODACTYL_URL || 'https://panel.domain.com';
  const successText = `\u{2705} Panel Berhasil Dibuat

Email: ${email}
Username: ${username}
Password: ${password}
URL Panel: ${panelUrl}
Masa Aktif: ${expiredText}

Silakan login dan segera ganti password Anda.`;

  await bot.sendMessage(chatId, successText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '\u{1F3E0} Menu Utama', callback_data: 'home' }],
      ],
    },
  });

  logger.info(`Panel ${invoice} completed for user ${user.id}`);
}

async function handleCheckPayment(bot, chatId, messageId, invoice) {
  try {
    const transaction = await Transaction.findOne({
      where: { invoice },
      include: [Product, User],
    });

    if (!transaction) {
      await bot.editMessageText('\u{274C} Transaksi tidak ditemukan.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'home' }]] },
      });
      return;
    }

    if (transaction.status !== 'pending') {
      await bot.editMessageText(`\u{26A0} Status transaksi: ${transaction.status.toUpperCase()}

Invoice: ${invoice}`, {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'home' }]] },
      });
      return;
    }

    const payment = await paymentService.checkPayment(invoice, transaction.price);

    if (payment.status !== 'completed') {
      await bot.editMessageText('\u{23F3} Pembayaran belum dikonfirmasi.\n\nSilakan scan QR dan lakukan pembayaran terlebih dahulu, lalu klik "Sudah Bayar" lagi.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: paymentQrKeyboard(invoice),
      });
      return;
    }

    await bot.editMessageText('\u{2705} Pembayaran diterima!\n\n\u{23F3} Sedang membuat akun panel...\nMohon tunggu beberapa saat.', {
      chat_id: chatId, message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    });

    await transaction.update({ status: 'paid', payment_method: 'qris', payment_ref: payment.order_id || invoice });

    const user = transaction.User;
    const product = transaction.Product;

    await createPanelServer(bot, chatId, transaction, user, product, invoice);
  } catch (error) {
    logger.error('Error in handleCheckPayment:', error);
    await bot.sendMessage(chatId, '\u{274C} Gagal memproses pembayaran. Silakan hubungi admin.', {
      reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'home' }]] },
    });
  }
}

module.exports = { handleBuy, handleBuyWithQris, handleBuyWithBalance, handleCheckPayment };
