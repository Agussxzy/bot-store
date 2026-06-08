const QRCode = require('qrcode');
const { Product, Transaction } = require('../models');
const { vpsDetailKeyboard, vpsPaymentKeyboard } = require('../keyboards/vpsMenu');
const { formatRupiah, generateInvoice } = require('../utils/formatter');
const paymentService = require('../services/paymentService');
const doService = require('../services/digitaloceanService');
const logger = require('../utils/logger');

async function handleVpsList(bot, chatId, messageId) {
  try {
    const products = await Product.findAll({
      where: { type: 'vps' },
      order: [['price', 'ASC']],
    });

    if (products.length === 0) {
      await bot.editMessageText('\u{274C} Belum ada VPS tersedia.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'home' }]] },
      });
      return;
    }

    const { vpsListKeyboard } = require('../keyboards/vpsMenu');
    await bot.editMessageText('\u{1F5A5} Pilih VPS Plan:', {
      chat_id: chatId, message_id: messageId,
      reply_markup: vpsListKeyboard(products),
    });
  } catch (error) {
    logger.error('Error in handleVpsList:', error);
  }
}

async function handleVpsDetail(bot, chatId, messageId, productId) {
  try {
    const product = await Product.findByPk(productId);
    if (!product) {
      await bot.editMessageText('\u{274C} Produk tidak ditemukan.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'vps' }]] },
      });
      return;
    }

    const meta = product.metadata ? JSON.parse(product.metadata) : {};
    const region = process.env.DO_REGION_SLUG || 'sgp1';
    const image = process.env.DO_IMAGE_SLUG || 'ubuntu-24-04-x64';

    const text = `\u{1F5A5} ${product.name}

\u{1F7E2} CPU: ${meta.vcpus || product.cpu}vCPU
\u{1F7E2} RAM: ${meta.ram_display || product.ram}MB
\u{1F7E2} Disk: ${meta.disk_display || product.disk}GB
\u{1F7E2} Transfer: ${meta.transfer || '-'}TB
\u{1F7E2} Harga: ${formatRupiah(product.price)}
\u{1F4CD} Region: ${region}
\u{1F4F2} OS: ${image}`;

    await bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      reply_markup: vpsDetailKeyboard(product.id),
    });
  } catch (error) {
    logger.error('Error in handleVpsDetail:', error);
  }
}

async function handleVpsBuyInit(bot, chatId, messageId, productId, telegramId) {
  try {
    const product = await Product.findByPk(productId);
    if (!product) {
      await bot.editMessageText('\u{274C} Produk tidak ditemukan.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'vps' }]] },
      });
      return;
    }

    await bot.editMessageText(`\u{1F511} Masukkan password untuk VPS Anda:

Minimal 8 karakter, kombinasi huruf dan angka.

Contoh: Admin1234

(VPS: ${product.name})`, {
      chat_id: chatId, message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          [{ text: '\u{1F519} Batal', callback_data: 'vps' }],
        ],
      },
    });

    return { productId };
  } catch (error) {
    logger.error('Error in handleVpsBuyInit:', error);
  }
}

async function handleVpsBuyPassword(bot, msg, user, productId) {
  const chatId = msg.chat.id;
  const password = msg.text.trim();

  if (password.length < 8) {
    await bot.sendMessage(chatId, '\u{274C} Password minimal 8 karakter. Silakan coba lagi.');
    return;
  }

  try {
    await bot.sendMessage(chatId, '\u{23F3} Menyiapkan pembayaran...');

    const product = await Product.findByPk(productId);
    if (!product) {
      await bot.sendMessage(chatId, '\u{274C} Produk tidak ditemukan.', {
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'vps' }]] },
      });
      return;
    }

    const invoice = generateInvoice();

    const transaction = await Transaction.create({
      invoice,
      user_id: user.id,
      product_id: product.id,
      price: product.price,
      status: 'pending',
      metadata: JSON.stringify({ vps_password: password }),
    });

    const payment = await paymentService.createPayment(invoice, product.price);

    const qrBuffer = await QRCode.toBuffer(payment.payment_url, {
      type: 'png', width: 512, margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    const caption = `\u{1F4B3} Pembayaran QRIS

VPS: ${product.name}
Invoice: ${invoice}
Total: ${formatRupiah(product.price)}

Scan QR di atas untuk membayar.

Setelah bayar, VPS akan dibuat otomatis dengan password yang Anda masukkan.`;

    await bot.sendPhoto(chatId, qrBuffer, {
      caption,
      reply_markup: vpsPaymentKeyboard(invoice),
    });

    logger.info(`VPS payment created: ${invoice} for user ${user.id}`);
  } catch (error) {
    logger.error('Error in handleVpsBuyPassword:', error);
    await bot.sendMessage(chatId, '\u{274C} Gagal memproses. Silakan coba lagi.');
  }
}

async function handleVpsCheckPayment(bot, chatId, messageId, invoice) {
  try {
    const transaction = await Transaction.findOne({
      where: { invoice },
      include: [Product],
    });

    if (!transaction) {
      await bot.editMessageText('\u{274C} Transaksi tidak ditemukan.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'vps' }]] },
      });
      return;
    }

    if (transaction.status !== 'pending') {
      await bot.editMessageText(`\u{26A0} Status transaksi: ${transaction.status.toUpperCase()}

Invoice: ${invoice}`, {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'vps' }]] },
      });
      return;
    }

    const payment = await paymentService.checkPayment(invoice, transaction.price);

    if (payment.status !== 'completed') {
      await bot.editMessageText('\u{23F3} Pembayaran belum dikonfirmasi.\n\nSilakan scan QR dan lakukan pembayaran, lalu klik "Sudah Bayar" lagi.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: vpsPaymentKeyboard(invoice),
      });
      return;
    }

    await bot.editMessageText('\u{2705} Pembayaran diterima!\n\n\u{23F3} Sedang membuat VPS...\nIni membutuhkan waktu beberapa menit.', {
      chat_id: chatId, message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    });

    await transaction.update({ status: 'paid' });

    const product = transaction.Product;
    const meta = product.metadata ? JSON.parse(product.metadata) : {};
    const sizeSlug = meta.size_slug || 's-1vcpu-1gb';
    const txnMeta = transaction.metadata ? JSON.parse(transaction.metadata) : {};
    const password = txnMeta.vps_password || 'default123';

    const dropletName = `vps-${transaction.user_id}-${Date.now()}`;
    const droplet = await doService.createDroplet(dropletName, sizeSlug, password);

    await transaction.update({
      status: 'processing',
      server_id: String(droplet.id),
      metadata: JSON.stringify({ ...txnMeta, droplet_id: droplet.id }),
    });

    const result = await doService.waitForDropletActive(droplet.id);

    if (!result) {
      await bot.sendMessage(chatId, '\u{26A0} VPS dibuat tapi masih provisioning. Cek status nanti atau hubungi admin.', {
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'home' }]] },
      });
      await transaction.update({ status: 'processing' });
      return;
    }

    await transaction.update({
      status: 'success',
      server_id: String(result.id),
      payment_method: 'qris',
      payment_ref: invoice,
      metadata: JSON.stringify({ ...txnMeta, droplet_id: result.id, ip: result.ip }),
    });

    const successText = `\u{2705} VPS Berhasil Dibuat

\u{1F310} IP: ${result.ip}
\u{1F511} Password: ${password}
\u{1F5A5} OS: ${process.env.DO_IMAGE_SLUG || 'ubuntu-24-04-x64'}
\u{1F4CD} Region: ${process.env.DO_REGION_SLUG || 'sgp1'}

SSH login:
ssh root@${result.ip}

Silakan login dan segera ganti password Anda.`;

    await bot.sendMessage(chatId, successText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '\u{1F3E0} Menu Utama', callback_data: 'home' }],
        ],
      },
    });

    logger.info(`VPS ${result.id} created for ${invoice}`);
  } catch (error) {
    logger.error('Error in handleVpsCheckPayment:', error);
    await bot.sendMessage(chatId, '\u{274C} Gagal membuat VPS. Silakan hubungi admin.', {
      reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'home' }]] },
    });
  }
}

module.exports = { handleVpsList, handleVpsDetail, handleVpsBuyInit, handleVpsBuyPassword, handleVpsCheckPayment };
