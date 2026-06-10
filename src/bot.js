require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const sequelize = require('./config/database');
const logger = require('./utils/logger');
const userService = require('./services/userService');

const { adminMenuKeyboard } = require('./keyboards/adminMenu');
const { formatRupiah, formatDate } = require('./utils/formatter');
const { handleStart, handleHome, handleHelp } = require('./handlers/start');
const { handleProductList, handleProductDetail } = require('./handlers/products');
const { handleBuy, handleBuyWithQris, handleBuyWithBalance, handleCheckPayment } = require('./handlers/purchase');
const { handleProfile, handleHistory } = require('./handlers/profile');
const { handleVpsList, handleVpsDetail, handleVpsBuyInit, handleVpsBuyPassword, handleVpsBuyWithQris, handleVpsBuyWithBalance, handleVpsCheckPayment } = require('./handlers/vps');
const {
  isAdmin, handleAdminMenu, handleAdminStats,
  handleAdminProducts, handleAdminProductAdd, handleAdminVpsAdd, handleAdminProductAddInput,
  handleAdminUsers, handleAdminUserAction,
  handleAdminTransactions, handleAdminServers,
} = require('./handlers/admin');
const {
  handleBroadcastInit, handleBroadcastConfirm, handleBroadcastStart,
} = require('./handlers/broadcast');
const { handleTopupInit, handleTopupAmount, handleTopupCheckPayment } = require('./handlers/topup');
const { startExpiryChecker } = require('./services/expiryService');
const { startBackupScheduler, handleAdminBackup, handleAdminBackupCreate, handleAdminRestoreInit, restoreFromZip } = require('./services/backupService');
const {
  handleManualQrisPanel, handleManualQrisVps, handleUserSubmitProof,
  handleAdminManualPayments, handleAdminManualConfirm, handleAdminManualReject, handleAdminSetQris,
} = require('./handlers/manualQris');

const token = process.env.BOT_TOKEN;
if (!token) {
  logger.error('BOT_TOKEN tidak ditemukan di .env');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

const adminInputState = new Map();
const vpsInputState = new Map();
const manualQrisState = new Map();

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const isAdminUser = await isAdmin(telegramId);

  await handleStart(bot, msg);
});

bot.onText(/\/admin/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  if (!(await isAdmin(telegramId))) {
    await bot.sendMessage(chatId, '\u{274C} Akses ditolak.');
    return;
  }

  await bot.sendMessage(chatId, '\u{1F6E1} Panel Admin\n\nSilakan pilih menu:', {
    reply_markup: adminMenuKeyboard(),
  });
});

bot.on('message', async (msg) => {
  if (msg.text && msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const stateKey = `${chatId}_${telegramId}`;
  let state = adminInputState.get(stateKey) || manualQrisState.get(stateKey);

  if (state) {
    adminInputState.delete(stateKey);
    manualQrisState.delete(stateKey);

    if (!['broadcast_content', 'manual_qris_photo', 'set_qris_photo', 'restore_backup'].includes(state.action) && !msg.text) return;

    if (state.action === 'add_product') {
      await handleAdminProductAddInput(bot, msg, state);
      return;
    }

    if (state.action === 'add_balance') {
      const amount = parseInt(msg.text);
      if (isNaN(amount) || amount <= 0) {
        await bot.sendMessage(chatId, '\u{274C} Jumlah tidak valid. Masukkan angka positif.');
        return;
      }
      try {
        await userService.addBalance(state.userId, amount);
        await bot.sendMessage(chatId, `\u{2705} Saldo berhasil ditambahkan: ${formatRupiah(amount)}`);
      } catch (error) {
        await bot.sendMessage(chatId, '\u{274C} Gagal menambah saldo.');
      }
      return;
    }

    if (state.action === 'sub_balance') {
      const amount = parseInt(msg.text);
      if (isNaN(amount) || amount <= 0) {
        await bot.sendMessage(chatId, '\u{274C} Jumlah tidak valid. Masukkan angka positif.');
        return;
      }
      try {
        await userService.subtractBalance(state.userId, amount);
        await bot.sendMessage(chatId, `\u{2705} Saldo berhasil dikurangi: ${formatRupiah(amount)}`);
      } catch (error) {
        await bot.sendMessage(chatId, '\u{274C} Gagal mengurangi saldo.');
      }
      return;
    }

    if (state.action === 'vps_password') {
      vpsInputState.delete(stateKey);
      await handleVpsBuyPassword(bot, msg, state.user, state.productId);
      return;
    }

    if (state.action === 'search_user') {
      const results = await userService.searchUsers(msg.text);
      if (results.length === 0) {
        await bot.sendMessage(chatId, '\u{274C} User tidak ditemukan.', {
          reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'admin_users_0' }]] },
        });
        return;
      }
      let text = '\u{1F50D} Hasil Pencarian:\n\n';
      for (const u of results) {
        text += `${u.id}. ${u.name || '-'} (@${u.username || '-'})\n   ID: ${u.telegram_id} | Saldo: ${formatRupiah(u.balance)}\n\n`;
      }
      text += 'Klik ID user untuk mengelola:';
      await bot.sendMessage(chatId, text, {
        reply_markup: {
          inline_keyboard: [
            ...results.map(u => ([{ text: `${u.id} - ${u.name || u.telegram_id}`, callback_data: `admin_user_view_${u.id}` }])),
            [{ text: '\u{1F519} Kembali', callback_data: 'admin_users_0' }],
          ],
        },
      });
      return;
    }

    if (state.action === 'broadcast_content') {
      const fromChatId = msg.chat.id;
      const msgId = msg.message_id;
      adminInputState.set(stateKey, { action: 'broadcast_confirm', fromChatId, msgId });
      await handleBroadcastConfirm(bot, chatId, fromChatId, msgId);
      return;
    }

    if (state.action === 'topup_amount') {
      const amount = parseInt(msg.text);
      if (isNaN(amount) || amount < 1000) {
        await bot.sendMessage(chatId, '\u{274C} Minimal top up Rp1.000. Masukkan jumlah yang valid.');
        return;
      }
      await handleTopupAmount(bot, chatId, telegramId, amount);
      return;
    }

    if (state.action === 'manual_qris_photo') {
      if (!msg.photo) {
        await bot.sendMessage(chatId, '\u{274C} Silakan kirim foto bukti transfer.');
        return;
      }
      manualQrisState.delete(stateKey);
      await handleUserSubmitProof(bot, msg, state);
      return;
    }

    if (state.action === 'set_qris_photo') {
      if (!msg.photo) {
        await bot.sendMessage(chatId, '\u{274C} Silakan kirim foto QRIS.');
        return;
      }
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      const { Config } = require('./models');
      await Config.upsert({ key: 'manual_qris_file_id', value: fileId });
      await bot.sendMessage(chatId, '\u{2705} QRIS berhasil disimpan!');
      return;
    }

    if (state.action === 'restore_backup') {
      if (!msg.document || !msg.document.file_name?.endsWith('.zip')) {
        await bot.sendMessage(chatId, '\u{274C} Silakan kirim file backup (.zip).');
        return;
      }
      await restoreFromZip(bot, chatId, msg.document.file_id);
      return;
    }

    if (state.action === 'extend_days') {
      const days = parseInt(msg.text);
      if (isNaN(days) || days < 1) {
        await bot.sendMessage(chatId, '\u{274C} Masukkan jumlah hari yang valid (minimal 1).');
        return;
      }
      const { Transaction } = require('./models');
      const tx = await Transaction.findByPk(state.txId);
      if (!tx) {
        await bot.sendMessage(chatId, '\u{274C} Transaksi tidak ditemukan.');
        return;
      }
      const oldExpiry = tx.expires_at ? new Date(tx.expires_at) : new Date();
      const newExpiry = new Date(oldExpiry.getTime() + days * 24 * 60 * 60 * 1000);
      await tx.update({ expires_at: newExpiry });
      const user = await userService.getUserById(tx.user_id);
      if (user) {
        try {
          await bot.sendMessage(parseInt(user.telegram_id), `\u{2705} Server Panel Anda diperpanjang ${days} hari!\n\nInvoice: ${tx.invoice}\nExpired baru: ${formatDate(newExpiry)}`, {
            reply_markup: { inline_keyboard: [[{ text: '\u{1F3E0} Menu Utama', callback_data: 'home' }]] },
          });
        } catch (err) {
          logger.warn(`Gagal notifikasi user ${user.telegram_id}: ${err.message}`);
        }
      }
      await bot.sendMessage(chatId, `\u{2705} Server diperpanjang ${days} hari! Expired baru: ${formatDate(newExpiry)}`);
      return;
    }
  }
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;
  const telegramId = query.from.id;

  try {
    await bot.answerCallbackQuery(query.id);

    const user = await userService.findOrCreateUser(
      telegramId,
      query.from.username || null,
      query.from.first_name || 'User'
    );

    if (user.is_banned && !['home', 'help'].includes(data.split('_')[0]) && !data.startsWith('admin')) {
      await bot.editMessageText('\u{26D4} Akun Anda telah dibanned. Hubungi admin.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'home' }]] },
      });
      return;
    }

    const isAdminUser = await isAdmin(telegramId);

    switch (data) {
      case 'home':
        await handleHome(bot, chatId, messageId, user);
        break;

      case 'help':
        await handleHelp(bot, chatId, messageId);
        break;

      case 'products':
        await handleProductList(bot, chatId, messageId);
        break;

      case 'profile':
        await handleProfile(bot, chatId, messageId, user.id);
        break;

      case 'admin':
        if (!isAdminUser) break;
        await handleAdminMenu(bot, chatId, messageId);
        break;

      case 'admin_stats':
        if (!isAdminUser) break;
        await handleAdminStats(bot, chatId, messageId);
        break;

      case 'vps':
        await handleVpsList(bot, chatId, messageId);
        break;

      case 'topup':
        adminInputState.set(`${chatId}_${telegramId}`, { action: 'topup_amount' });
        await handleTopupInit(bot, chatId, messageId);
        break;

      case 'admin_product_add':
        if (!isAdminUser) break;
        adminInputState.set(`${chatId}_${telegramId}`, { action: 'add_product', productType: 'panel' });
        await handleAdminProductAdd(bot, chatId, messageId);
        break;

      case 'admin_vps_add':
        if (!isAdminUser) break;
        adminInputState.set(`${chatId}_${telegramId}`, { action: 'add_product', productType: 'vps' });
        await handleAdminVpsAdd(bot, chatId, messageId);
        break;

      case 'admin_user_search':
        if (!isAdminUser) break;
        adminInputState.set(`${chatId}_${telegramId}`, { action: 'search_user' });
        await bot.editMessageText('\u{1F50D} Masukkan ID, username, atau nama user yang dicari:', {
          chat_id: chatId, message_id: messageId,
          reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Batal', callback_data: 'admin_users_0' }]] },
        });
        break;

      case 'admin_broadcast':
        if (!isAdminUser) break;
        adminInputState.set(`${chatId}_${telegramId}`, { action: 'broadcast_content' });
        await handleBroadcastInit(bot, chatId, messageId);
        break;

      case 'admin_set_qris':
        if (!isAdminUser) break;
        adminInputState.set(`${chatId}_${telegramId}`, { action: 'set_qris_photo' });
        await handleAdminSetQris(bot, chatId, messageId);
        break;

      case 'admin_backup':
        if (!isAdminUser) break;
        await handleAdminBackup(bot, chatId, messageId);
        break;

      case 'admin_backup_create':
        if (!isAdminUser) break;
        await handleAdminBackupCreate(bot, chatId, messageId);
        break;

      case 'admin_backup_restore':
        if (!isAdminUser) break;
        adminInputState.set(`${chatId}_${telegramId}`, { action: 'restore_backup' });
        await handleAdminRestoreInit(bot, chatId, messageId);
        break;

      default:
        await handleCallbackData(bot, chatId, messageId, data, user, isAdminUser, telegramId);
        break;
    }
  } catch (error) {
    logger.error('Callback error:', error);
  }
});

async function handleCallbackData(bot, chatId, messageId, data, user, isAdminUser, telegramId) {
  if (data.startsWith('product_')) {
    const productId = parseInt(data.split('_')[1]);
    await handleProductDetail(bot, chatId, messageId, productId);
    return;
  }

  if (data.startsWith('buy_manual_')) {
    const productId = parseInt(data.split('_')[2]);
    manualQrisState.set(`${chatId}_${telegramId}`, { action: 'manual_qris_photo', type: 'panel', productId, userId: user.id });
    await handleManualQrisPanel(bot, chatId, messageId, productId, user.id);
    return;
  }

  if (data.startsWith('buy_balance_')) {
    const productId = parseInt(data.split('_')[2]);
    await handleBuyWithBalance(bot, chatId, messageId, productId, user.id);
    return;
  }

  if (data.startsWith('buy_qris_')) {
    const productId = parseInt(data.split('_')[2]);
    await handleBuyWithQris(bot, chatId, messageId, productId, user.id);
    return;
  }

  if (data.startsWith('buy_')) {
    const productId = parseInt(data.split('_')[1]);
    await handleBuy(bot, chatId, messageId, productId, user.id);
    return;
  }

  if (data.startsWith('vps_buy_manual_')) {
    const invoice = data.slice('vps_buy_manual_'.length);
    manualQrisState.set(`${chatId}_${telegramId}`, { action: 'manual_qris_photo', type: 'vps', invoice });
    await handleManualQrisVps(bot, chatId, invoice);
    return;
  }

  if (data.startsWith('admin_manual_payments_')) {
    if (!isAdminUser) return;
    const page = parseInt(data.split('_')[3]) || 0;
    await handleAdminManualPayments(bot, chatId, messageId, page);
    return;
  }

  if (data.startsWith('admin_manual_confirm_')) {
    if (!isAdminUser) return;
    const invoice = data.slice('admin_manual_confirm_'.length);
    await handleAdminManualConfirm(bot, chatId, messageId, invoice);
    return;
  }

  if (data.startsWith('admin_manual_reject_')) {
    if (!isAdminUser) return;
    const invoice = data.slice('admin_manual_reject_'.length);
    await handleAdminManualReject(bot, chatId, messageId, invoice);
    return;
  }

  if (data.startsWith('topup_check_')) {
    const invoice = data.slice('topup_check_'.length);
    await handleTopupCheckPayment(bot, chatId, messageId, invoice);
    return;
  }

  if (data.startsWith('check_')) {
    const invoice = data.split('_')[1];
    await handleCheckPayment(bot, chatId, messageId, invoice);
    return;
  }

  if (data.startsWith('vps_buy_balance_')) {
    const invoice = data.slice('vps_buy_balance_'.length);
    await handleVpsBuyWithBalance(bot, chatId, messageId, invoice, user.id);
    return;
  }

  if (data.startsWith('vps_buy_qris_')) {
    const invoice = data.slice('vps_buy_qris_'.length);
    await handleVpsBuyWithQris(bot, chatId, messageId, invoice);
    return;
  }

  if (data.startsWith('vps_')) {
    const parts = data.split('_');
    if (parts.length === 2) {
      const productId = parseInt(parts[1]);
      await handleVpsDetail(bot, chatId, messageId, productId);
    } else if (parts[1] === 'buy') {
      const productId = parseInt(parts[2]);
      const result = await handleVpsBuyInit(bot, chatId, messageId, productId, telegramId);
      if (result) {
        vpsInputState.set(`${chatId}_${telegramId}`, { action: 'vps_password', productId: result.productId, user });
      }
    } else if (parts[1] === 'check') {
      const invoice = parts.slice(2).join('_');
      await handleVpsCheckPayment(bot, chatId, messageId, invoice);
    }
    return;
  }

  if (data.startsWith('history_')) {
    const page = parseInt(data.split('_')[1]) || 0;
    await handleHistory(bot, chatId, messageId, user.id, page);
    return;
  }

  if (data.startsWith('admin_products_')) {
    if (!isAdminUser) return;
    const page = parseInt(data.split('_')[2]) || 0;
    await handleAdminProducts(bot, chatId, messageId, page);
    return;
  }

  if (data.startsWith('admin_users_')) {
    if (!isAdminUser) return;
    const page = parseInt(data.split('_')[2]) || 0;
    await handleAdminUsers(bot, chatId, messageId, page);
    return;
  }

  if (data.startsWith('admin_transactions_')) {
    if (!isAdminUser) return;
    const page = parseInt(data.split('_')[2]) || 0;
    await handleAdminTransactions(bot, chatId, messageId, page);
    return;
  }

  if (data.startsWith('admin_servers_')) {
    if (!isAdminUser) return;
    const page = parseInt(data.split('_')[2]) || 0;
    await handleAdminServers(bot, chatId, messageId, page);
    return;
  }

  if (data.startsWith('admin_extend_')) {
    if (!isAdminUser) return;
    const txId = parseInt(data.split('_')[2]);
    adminInputState.set(`${chatId}_${telegramId}`, { action: 'extend_days', txId });
    await bot.editMessageText('\u{1F4C5} Masukkan jumlah hari perpanjangan:', {
      chat_id: chatId, message_id: messageId,
      reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Batal', callback_data: 'admin_servers_0' }]] },
    });
    return;
  }

  if (data.startsWith('admin_user_ban_')) {
    if (!isAdminUser) return;
    const targetId = parseInt(data.split('_')[3]);
    await handleAdminUserAction(bot, chatId, messageId, 'ban', targetId);
    return;
  }

  if (data.startsWith('admin_user_unban_')) {
    if (!isAdminUser) return;
    const targetId = parseInt(data.split('_')[3]);
    await handleAdminUserAction(bot, chatId, messageId, 'unban', targetId);
    return;
  }

  if (data.startsWith('admin_user_addbal_')) {
    if (!isAdminUser) return;
    const targetId = parseInt(data.split('_')[3]);
    adminInputState.set(`${chatId}_${telegramId}`, { action: 'add_balance', userId: targetId });
    await handleAdminUserAction(bot, chatId, messageId, 'addbal', targetId);
    return;
  }

  if (data.startsWith('admin_user_subbal_')) {
    if (!isAdminUser) return;
    const targetId = parseInt(data.split('_')[3]);
    adminInputState.set(`${chatId}_${telegramId}`, { action: 'sub_balance', userId: targetId });
    await handleAdminUserAction(bot, chatId, messageId, 'subbal', targetId);
    return;
  }

  if (data.startsWith('admin_user_view_')) {
    if (!isAdminUser) return;
    const targetId = parseInt(data.split('_')[3]);
    const targetUser = await userService.getUserById(targetId);
    if (!targetUser) return;
    const text = `\u{1F464} Detail User

ID: ${targetUser.id}
Telegram ID: ${targetUser.telegram_id}
Nama: ${targetUser.name || '-'}
Username: @${targetUser.username || '-'}
Saldo: ${formatRupiah(targetUser.balance)}
Status: ${targetUser.is_banned ? '\u{26D4} Banned' : '\u{2705} Aktif'}
Bergabung: ${formatDate(targetUser.created_at)}`;
    await bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      reply_markup: (require('./keyboards/adminMenu')).adminUserActionKeyboard(targetId),
    });
    return;
  }

  if (data === 'admin_broadcast_cancel') {
    if (!isAdminUser) return;
    adminInputState.delete(`${chatId}_${telegramId}`);
    await handleAdminMenu(bot, chatId, messageId);
    return;
  }

  if (data === 'admin_broadcast_confirm_yes') {
    if (!isAdminUser) return;
    const stateKey = `${chatId}_${telegramId}`;
    const state = adminInputState.get(stateKey);
    if (!state || state.action !== 'broadcast_confirm') return;
    adminInputState.delete(stateKey);
    await handleBroadcastStart(bot, chatId, messageId, state.fromChatId, state.msgId);
    return;
  }
}

async function start() {
  try {
    await sequelize.authenticate();
    logger.info('Database connected');

    const { User, Product, Transaction, Config } = require('./models/index');
    await sequelize.sync({ alter: true });
    logger.info('Database synced');

    startExpiryChecker(bot);
    startBackupScheduler(bot);

    logger.info('Bot started');
  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
}

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection:', error);
});

start();
