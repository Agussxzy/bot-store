const { User, Product, Transaction, Config } = require('../models');
const { formatRupiah, generateInvoice, generatePassword } = require('../utils/formatter');
const pterodactylService = require('../services/pterodactylService');
const doService = require('../services/digitaloceanService');
const userService = require('../services/userService');
const logger = require('../utils/logger');

const adminChatId = parseInt(process.env.ADMIN_ID);

async function getQrisFileId() {
  const cfg = await Config.findOne({ where: { key: 'manual_qris_file_id' } });
  return cfg ? cfg.value : null;
}

async function handleManualQrisPanel(bot, chatId, messageId, productId, userId) {
  const product = await Product.findByPk(productId);
  if (!product) {
    await bot.editMessageText('\u{274C} Produk tidak ditemukan.', {
      chat_id: chatId, message_id: messageId,
      reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'products' }]] },
    });
    return null;
  }

  const qrisFileId = await getQrisFileId();
  if (!qrisFileId) {
    await bot.editMessageText('\u{274C} QRIS toko belum di-set. Hubungi admin.', {
      chat_id: chatId, message_id: messageId,
      reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'products' }]] },
    });
    return null;
  }

  await bot.editMessageText(`\u{1F4B3} Manual QRIS\n\n${product.name}\nHarga: ${formatRupiah(product.price)}\n\nSilakan transfer ke QR di atas, lalu kirim FOTO BUKTI TRANSFER ke chat ini.`, {
    chat_id: chatId, message_id: messageId,
    reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Batal', callback_data: 'products' }]] },
  });

  await bot.sendPhoto(chatId, qrisFileId, {
    caption: `Scan QRIS untuk membayar ${product.name}\nSetelah transfer, kirim FOTO BUKTI TRANSFER ke chat ini.`,
  });

  return { productId, userId };
}

async function handleManualQrisVps(bot, chatId, invoice) {
  const qrisFileId = await getQrisFileId();
  if (!qrisFileId) {
    await bot.sendMessage(chatId, '\u{274C} QRIS toko belum di-set. Hubungi admin.');
    return;
  }

  await bot.sendMessage(chatId, `\u{1F4B3} Manual QRIS\n\nSilakan transfer ke QR di atas, lalu kirim FOTO BUKTI TRANSFER ke chat ini.`);

  await bot.sendPhoto(chatId, qrisFileId, {
    caption: `Scan QRIS untuk membayar invoice *${invoice}*\nSetelah transfer, kirim FOTO BUKTI TRANSFER ke chat ini.`,
    parse_mode: 'Markdown',
  });
}

async function handleUserSubmitProof(bot, msg, state) {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const photo = msg.photo[msg.photo.length - 1];
  const fileId = photo.file_id;

  try {
    let invoice, transaction, product, user;

    if (state.type === 'panel') {
      const productObj = await Product.findByPk(state.productId);
      if (!productObj) {
        await bot.sendMessage(chatId, '\u{274C} Produk tidak ditemukan.');
        return;
      }

      const userObj = await userService.getUserById(state.userId);
      if (!userObj) {
        await bot.sendMessage(chatId, '\u{274C} User tidak ditemukan.');
        return;
      }

      invoice = generateInvoice();
      transaction = await Transaction.create({
        invoice,
        user_id: state.userId,
        product_id: state.productId,
        price: productObj.price,
        status: 'pending',
        payment_method: 'manual_qris',
        metadata: JSON.stringify({ proof_file_id: fileId }),
      });
      product = productObj;
      user = userObj;
    } else {
      transaction = await Transaction.findOne({ where: { invoice: state.invoice }, include: [Product, User] });
      if (!transaction) {
        await bot.sendMessage(chatId, '\u{274C} Transaksi tidak ditemukan.');
        return;
      }

      invoice = transaction.invoice;
      product = transaction.Product;
      user = transaction.User;

      const txnMeta = transaction.metadata ? JSON.parse(transaction.metadata) : {};
      txnMeta.proof_file_id = fileId;
      txnMeta.payment_method = 'manual_qris';
      await transaction.update({ metadata: JSON.stringify(txnMeta), payment_method: 'manual_qris' });
    }

    const caption = `\u{1F4E9} Bukti Transfer Baru

User: ${user.name || user.telegram_id}
Produk: ${product.name}
Invoice: ${invoice}
Jumlah: ${formatRupiah(transaction.price)}`;

    if (adminChatId) {
      await bot.sendPhoto(adminChatId, fileId, {
        caption,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '\u{2705} Konfirmasi', callback_data: `admin_manual_confirm_${invoice}` },
              { text: '\u{274C} Tolak', callback_data: `admin_manual_reject_${invoice}` },
            ],
          ],
        },
      });
    }

    await bot.sendMessage(chatId, `\u{2705} Bukti transfer diterima!\nInvoice: ${invoice}\n\nMenunggu konfirmasi admin. Kami akan memberitahu kamu segera.`, {
      reply_markup: { inline_keyboard: [[{ text: '\u{1F3E0} Menu Utama', callback_data: 'home' }]] },
    });

    logger.info(`Manual QRIS proof submitted: ${invoice}`);
  } catch (error) {
    logger.error('Error in handleUserSubmitProof:', error);
    await bot.sendMessage(chatId, '\u{274C} Gagal memproses bukti transfer. Silakan coba lagi.');
  }
}

async function handleAdminManualConfirm(bot, adminChatId, messageId, invoice) {
  try {
    const transaction = await Transaction.findOne({ where: { invoice }, include: [Product, User] });
    if (!transaction || transaction.status !== 'pending') {
      await bot.editMessageText('\u{274C} Transaksi tidak valid atau sudah diproses.', {
        chat_id: adminChatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Admin Menu', callback_data: 'admin' }]] },
      });
      return;
    }

    await transaction.update({ status: 'paid' });

    const user = transaction.User;
    const product = transaction.Product;

    if (product.type === 'panel') {
      await createPanelServer(bot, transaction, user, product);
    } else {
      await createVpsDroplet(bot, transaction);
    }

    await bot.editMessageText(`\u{2705} Transaksi ${invoice} dikonfirmasi!`, {
      chat_id: adminChatId, message_id: messageId,
      reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Admin Menu', callback_data: 'admin' }]] },
    });

    logger.info(`Manual QRIS confirmed: ${invoice}`);
  } catch (error) {
    logger.error('Error in handleAdminManualConfirm:', error);
    await bot.sendMessage(adminChatId, '\u{274C} Gagal mengkonfirmasi transaksi.');
  }
}

async function handleAdminManualReject(bot, adminChatId, messageId, invoice) {
  try {
    const transaction = await Transaction.findOne({ where: { invoice }, include: [User] });
    if (!transaction || transaction.status !== 'pending') {
      await bot.editMessageText('\u{274C} Transaksi tidak valid atau sudah diproses.', {
        chat_id: adminChatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Admin Menu', callback_data: 'admin' }]] },
      });
      return;
    }

    await transaction.update({ status: 'failed' });

    const userChatId = parseInt(transaction.User.telegram_id);
    await bot.sendMessage(userChatId, `\u{274C} Bukti transfer untuk invoice ${invoice} ditolak.\n\nSilakan kirim ulang bukti transfer yang valid.`, {
      reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Menu Utama', callback_data: 'home' }]] },
    });

    await bot.editMessageText(`\u{274C} Transaksi ${invoice} ditolak.`, {
      chat_id: adminChatId, message_id: messageId,
      reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Admin Menu', callback_data: 'admin' }]] },
    });

    logger.info(`Manual QRIS rejected: ${invoice}`);
  } catch (error) {
    logger.error('Error in handleAdminManualReject:', error);
    await bot.sendMessage(adminChatId, '\u{274C} Gagal menolak transaksi.');
  }
}

async function handleAdminManualPayments(bot, chatId, messageId, page = 0) {
  try {
    const limit = 10;
    const { rows, count } = await Transaction.findAndCountAll({
      where: { payment_method: 'manual_qris', status: 'pending' },
      include: [User, Product],
      order: [['created_at', 'DESC']],
      offset: page * limit,
      limit,
    });
    const totalPages = Math.ceil(count / limit);

    if (rows.length === 0) {
      await bot.editMessageText('\u{2705} Tidak ada pembayaran manual yang menunggu konfirmasi.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'admin' }]] },
      });
      return;
    }

    let text = `\u{1F4E9} Pembayaran Manual Menunggu (${count})\n\n`;
    for (const t of rows) {
      const userName = t.User ? (t.User.name || t.User.username || t.User.telegram_id) : 'Unknown';
      const productName = t.Product ? t.Product.name : 'Top Up';
      text += `${t.invoice}\n\u{1F464} ${userName} | \u{1F4E6} ${productName}\n\u{1F4B0} ${formatRupiah(t.price)} | ${t.type}\n\n`;
    }

    const { adminManualPaymentsKeyboard } = require('../keyboards/adminMenu');
    await bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      reply_markup: adminManualPaymentsKeyboard(page, totalPages),
    });
  } catch (error) {
    logger.error('Error in handleAdminManualPayments:', error);
  }
}

async function createPanelServer(bot, transaction, user, product) {
  const email = `${user.username || 'user'}@telegram`;
  const password = generatePassword();
  const username = `panel_${user.id}_${Date.now()}`;

  const pterodactylUser = await pterodactylService.createPterodactylUser(email, username, password);
  const server = await pterodactylService.createPterodactylServer(pterodactylUser.id, product);

  await transaction.update({
    status: 'success',
    server_id: server.id,
  });

  const panelUrl = process.env.PTERODACTYL_URL || 'https://panel.domain.com';
  const successText = `\u{2705} Pembayaran Dikonfirmasi! Panel Berhasil Dibuat

Email: ${email}
Username: ${username}
Password: ${password}
URL Panel: ${panelUrl}
Invoice: ${transaction.invoice}

Silakan login dan segera ganti password Anda.`;

  await bot.sendMessage(parseInt(user.telegram_id), successText, {
    reply_markup: { inline_keyboard: [[{ text: '\u{1F3E0} Menu Utama', callback_data: 'home' }]] },
  });

  logger.info(`Panel ${transaction.invoice} completed via manual QRIS`);
}

async function createVpsDroplet(bot, transaction) {
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
    await bot.sendMessage(parseInt(transaction.User.telegram_id),
      '\u{26A0} VPS dibuat tapi masih provisioning. Cek status nanti atau hubungi admin.',
      { reply_markup: { inline_keyboard: [[{ text: '\u{1F3E0} Menu Utama', callback_data: 'home' }]] } }
    );
    await transaction.update({ status: 'processing' });
    return;
  }

  await transaction.update({
    status: 'success',
    server_id: String(result.id),
    metadata: JSON.stringify({ ...txnMeta, droplet_id: result.id, ip: result.ip }),
  });

  const successText = `\u{2705} Pembayaran Dikonfirmasi! VPS Berhasil Dibuat

\u{1F310} IP: ${result.ip}
\u{1F511} Password: ${password}
\u{1F5A5} OS: ${process.env.DO_IMAGE_SLUG || 'ubuntu-24-04-x64'}
\u{1F4CD} Region: ${process.env.DO_REGION_SLUG || 'sgp1'}
Invoice: ${transaction.invoice}

SSH login:
ssh root@${result.ip}

Silakan login dan segera ganti password Anda.`;

  await bot.sendMessage(parseInt(transaction.User.telegram_id), successText, {
    reply_markup: { inline_keyboard: [[{ text: '\u{1F3E0} Menu Utama', callback_data: 'home' }]] },
  });

  logger.info(`VPS ${result.id} created via manual QRIS for ${transaction.invoice}`);
}

async function handleAdminSetQris(bot, chatId, messageId) {
  await bot.editMessageText(`\u{1F4F7} Set QRIS Toko

Kirim foto QRIS yang akan digunakan untuk pembayaran manual.`, {
    chat_id: chatId, message_id: messageId,
    reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Batal', callback_data: 'admin' }]] },
  });
}

module.exports = {
  handleManualQrisPanel, handleManualQrisVps, handleUserSubmitProof,
  handleAdminManualConfirm, handleAdminManualReject, handleAdminManualPayments,
  handleAdminSetQris,
};
