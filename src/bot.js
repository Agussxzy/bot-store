require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const sequelize = require('./config/database');
const logger = require('./utils/logger');
const userService = require('./services/userService');

const { adminMenuKeyboard } = require('./keyboards/adminMenu');
const { formatRupiah, formatDate } = require('./utils/formatter');
const { handleStart, handleHome, handleHelp } = require('./handlers/start');
const { handleProductList, handleProductDetail } = require('./handlers/products');
const { handleBuy, handleCheckPayment } = require('./handlers/purchase');
const { handleProfile, handleHistory } = require('./handlers/profile');
const { handleVpsList, handleVpsDetail, handleVpsBuyInit, handleVpsBuyPassword, handleVpsCheckPayment } = require('./handlers/vps');
const {
  isAdmin, handleAdminMenu, handleAdminStats,
  handleAdminProducts, handleAdminProductAdd, handleAdminVpsAdd, handleAdminProductAddInput,
  handleAdminUsers, handleAdminUserAction,
  handleAdminTransactions,
} = require('./handlers/admin');
const {
  handleBroadcastInit, handleBroadcastConfirm, handleBroadcastStart,
} = require('./handlers/broadcast');

const token = process.env.BOT_TOKEN;
if (!token) {
  logger.error('BOT_TOKEN tidak ditemukan di .env');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

const adminInputState = new Map();
const vpsInputState = new Map();

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
  const state = adminInputState.get(stateKey);

  if (state) {
    adminInputState.delete(stateKey);

    if (state.action !== 'broadcast_content' && !msg.text) return;

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

  if (data.startsWith('buy_')) {
    const productId = parseInt(data.split('_')[1]);
    await handleBuy(bot, chatId, messageId, productId, user.id);
    return;
  }

  if (data.startsWith('check_')) {
    const invoice = data.split('_')[1];
    await handleCheckPayment(bot, chatId, messageId, invoice);
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
