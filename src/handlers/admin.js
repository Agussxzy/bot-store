const { User, Product, Transaction } = require('../models');
const { Op } = require('sequelize');
const { adminMenuKeyboard, adminProductManageKeyboard, adminUserManageKeyboard, adminUserActionKeyboard } = require('../keyboards/adminMenu');
const { formatRupiah, formatDate } = require('../utils/formatter');
const { formatSizeTable } = require('../utils/doSizes');
const userService = require('../services/userService');
const logger = require('../utils/logger');
const moment = require('moment-timezone');

async function isAdmin(telegramId) {
  const adminId = process.env.ADMIN_ID;
  return String(telegramId) === String(adminId);
}

async function handleAdminMenu(bot, chatId, messageId) {
  await bot.editMessageText('\u{1F6E1} Panel Admin\n\nSilakan pilih menu:', {
    chat_id: chatId, message_id: messageId,
    reply_markup: adminMenuKeyboard(),
  });
}

async function handleAdminStats(bot, chatId, messageId) {
  try {
    const totalUsers = await User.count();
    const totalTransactions = await Transaction.count();
    const todayStart = moment().tz('Asia/Jakarta').startOf('day').toDate();
    const monthStart = moment().tz('Asia/Jakarta').startOf('month').toDate();

    const todayRevenue = await Transaction.sum('price', {
      where: { status: 'success', created_at: { [Op.gte]: todayStart } },
    }) || 0;

    const monthRevenue = await Transaction.sum('price', {
      where: { status: 'success', created_at: { [Op.gte]: monthStart } },
    }) || 0;

    const text = `\u{1F4CA} Statistik

\u{1F465} Total User: ${totalUsers}
\u{1F4CB} Total Transaksi: ${totalTransactions}
\u{1F4B0} Pendapatan Hari Ini: ${formatRupiah(todayRevenue)}
\u{1F4B0} Pendapatan Bulan Ini: ${formatRupiah(monthRevenue)}`;

    await bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'admin' }]] },
    });
  } catch (error) {
    logger.error('Error in handleAdminStats:', error);
  }
}

async function handleAdminProducts(bot, chatId, messageId, page = 0) {
  try {
    const limit = 5;
    const { rows, count } = await Product.findAndCountAll({
      order: [['price', 'ASC']],
      offset: page * limit,
      limit,
    });
    const totalPages = Math.ceil(count / limit);

    let text = `\u{1F4E6} Kelola Produk (${count} total)\n\n`;
    if (rows.length === 0) {
      text += 'Belum ada produk.\n';
    } else {
      for (const p of rows) {
        text += `${p.id}. ${p.name}\n   RAM: ${p.ram}MB | CPU: ${p.cpu}% | Disk: ${p.disk}MB\n   Harga: ${formatRupiah(p.price)}\n\n`;
      }
    }

    await bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      reply_markup: adminProductManageKeyboard(page, totalPages),
    });
  } catch (error) {
    logger.error('Error in handleAdminProducts:', error);
  }
}

async function handleAdminProductAdd(bot, chatId, messageId) {
  const text = `\u{2795} Tambah Produk Panel Baru

Silakan kirim data produk dengan format:
Nama|RAM|CPU|Disk|Harga|DurasiHari

Durasi bersifat opsional (default 30 hari).

Contoh:
Panel 1GB|1024|50|1024|15000|30`;

  await bot.editMessageText(text, {
    chat_id: chatId, message_id: messageId,
    reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Batal', callback_data: 'admin_products_0' }]] },
  });
}

async function handleAdminVpsAdd(bot, chatId, messageId) {
  const ref = formatSizeTable();
  const text = `\u{2795} Tambah VPS Baru

Format: Nama|size_slug|harga|vcpus|ram_display|disk_display|transfer

Contoh:
\`VPS 1GB|s-1vcpu-1gb|15000|1|1024|25|1\`

\u{1F4CB} Referensi spesifikasi DigitalOcean:

${ref}

Gunakan \`size_slug\` dari tabel di atas.`;

  await bot.editMessageText(text, {
    chat_id: chatId, message_id: messageId,
    reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Batal', callback_data: 'admin_products_0' }]] },
  });
}

async function handleAdminProductAddInput(bot, msg, state) {
  try {
    const chatId = msg.chat.id;
    const parts = msg.text.split('|').map(s => s.trim());

    if (state?.productType === 'vps') {
      if (parts.length !== 7) {
        await bot.sendMessage(chatId, '\u{274C} Format salah. Gunakan: Nama|size_slug|harga|vcpus|ram|disk|transfer');
        return;
      }
      const [name, sizeSlug, price, vcpus, ramDisplay, diskDisplay, transfer] = parts;
      await Product.create({
        name,
        type: 'vps',
        ram: 0,
        cpu: 0,
        disk: 0,
        price: parseInt(price),
        metadata: JSON.stringify({
          size_slug: sizeSlug,
          vcpus: parseInt(vcpus),
          ram_display: parseInt(ramDisplay),
          disk_display: parseInt(diskDisplay),
          transfer: parseFloat(transfer),
        }),
      });
      await bot.sendMessage(chatId, `\u{2705} VPS "${name}" berhasil ditambahkan!`, {
        reply_markup: { inline_keyboard: [[{ text: '\u{1F4E6} Kelola Produk', callback_data: 'admin_products_0' }]] },
      });
    } else {
      if (parts.length < 5 || parts.length > 6) {
        await bot.sendMessage(chatId, '\u{274C} Format salah. Gunakan: Nama|RAM|CPU|Disk|Harga|DurasiHari');
        return;
      }
      const [name, ram, cpu, disk, price, durationRaw] = parts;
      const durationDays = durationRaw ? parseInt(durationRaw) : 30;
      if (durationDays < 1) {
        await bot.sendMessage(chatId, '\u{274C} Durasi minimal 1 hari.');
        return;
      }
      await Product.create({
        name,
        type: 'panel',
        ram: parseInt(ram),
        cpu: parseInt(cpu),
        disk: parseInt(disk),
        price: parseInt(price),
        duration_days: durationDays,
      });
      await bot.sendMessage(chatId, `\u{2705} Produk Panel "${name}" berhasil ditambahkan! (Masa aktif: ${durationDays} hari)`, {
        reply_markup: { inline_keyboard: [[{ text: '\u{1F4E6} Kelola Produk', callback_data: 'admin_products_0' }]] },
      });
    }
  } catch (error) {
    logger.error('Error adding product:', error);
  }
}

async function handleAdminUsers(bot, chatId, messageId, page = 0) {
  try {
    const limit = 5;
    const { users, total, totalPages } = await userService.getAllUsers(page, limit);

    let text = `\u{1F465} Kelola User (${total} total)\n\n`;
    for (const u of users) {
      text += `${u.id}. ${u.name || '-'} (@${u.username || '-'})\n   ID: ${u.telegram_id} | Saldo: ${formatRupiah(u.balance)} ${u.is_banned ? '| \u{26D4} BANNED' : ''}\n\n`;
    }

    await bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      reply_markup: adminUserManageKeyboard(page, totalPages),
    });
  } catch (error) {
    logger.error('Error in handleAdminUsers:', error);
  }
}

async function handleAdminUserAction(bot, chatId, messageId, action, targetUserId) {
  try {
    const user = await userService.getUserById(targetUserId);
    if (!user) {
      await bot.editMessageText('\u{274C} User tidak ditemukan.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'admin_users_0' }]] },
      });
      return;
    }

    switch (action) {
      case 'ban':
        await userService.banUser(targetUserId);
        await bot.editMessageText(`\u{2705} User ${user.name || user.telegram_id} telah di-ban.`, {
          chat_id: chatId, message_id: messageId,
          reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'admin_users_0' }]] },
        });
        break;
      case 'unban':
        await userService.unbanUser(targetUserId);
        await bot.editMessageText(`\u{2705} User ${user.name || user.telegram_id} telah di-unban.`, {
          chat_id: chatId, message_id: messageId,
          reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'admin_users_0' }]] },
        });
        break;
      case 'addbal':
        await bot.editMessageText(`\u{2795} Tambah Saldo\n\nUser: ${user.name || user.telegram_id}\nSaldo saat ini: ${formatRupiah(user.balance)}\n\nKetik jumlah saldo yang ingin ditambahkan:`, {
          chat_id: chatId, message_id: messageId,
          reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Batal', callback_data: 'admin_users_0' }]] },
        });
        break;
      case 'subbal':
        await bot.editMessageText(`\u{2796} Kurangi Saldo\n\nUser: ${user.name || user.telegram_id}\nSaldo saat ini: ${formatRupiah(user.balance)}\n\nKetik jumlah saldo yang ingin dikurangi:`, {
          chat_id: chatId, message_id: messageId,
          reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Batal', callback_data: 'admin_users_0' }]] },
        });
        break;
    }
  } catch (error) {
    logger.error('Error in handleAdminUserAction:', error);
  }
}

async function handleAdminTransactions(bot, chatId, messageId, page = 0) {
  try {
    const limit = 10;
    const { rows, count } = await Transaction.findAndCountAll({
      include: [User, Product],
      order: [['created_at', 'DESC']],
      offset: page * limit,
      limit,
    });
    const totalPages = Math.ceil(count / limit);

    if (rows.length === 0) {
      await bot.editMessageText('\u{1F4B0} Belum ada transaksi.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'admin' }]] },
      });
      return;
    }

    let text = `\u{1F4B0} Transaksi (Halaman ${page + 1}/${totalPages})\n\n`;
    for (const t of rows) {
      const userName = t.User ? (t.User.name || t.User.username || t.User.telegram_id) : 'Unknown';
      const productName = t.Product ? t.Product.name : 'Unknown';
      text += `${t.invoice}\n\u{1F464} ${userName} | \u{1F4E6} ${productName}\n\u{1F4B0} ${formatRupiah(t.price)} | \u{2139} ${t.status.toUpperCase()}\n\u{1F4C5} ${formatDate(t.created_at)}\n\n`;
    }

    const navRow = [];
    if (page > 0) navRow.push({ text: '\u{2B05}', callback_data: `admin_transactions_${page - 1}` });
    if (page < totalPages - 1) navRow.push({ text: '\u{27A1}', callback_data: `admin_transactions_${page + 1}` });

    const keyboard = { inline_keyboard: [] };
    if (navRow.length) keyboard.inline_keyboard.push(navRow);
    keyboard.inline_keyboard.push([{ text: '\u{1F519} Kembali', callback_data: 'admin' }]);

    await bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error('Error in handleAdminTransactions:', error);
  }
}

async function handleAdminServers(bot, chatId, messageId, page = 0) {
  try {
    const limit = 10;
    const { rows, count } = await Transaction.findAndCountAll({
      where: { status: 'success', type: 'purchase', server_id: { [Op.ne]: null } },
      include: [User, Product],
      order: [['expires_at', 'ASC']],
      offset: page * limit,
      limit,
    });
    const totalPages = Math.ceil(count / limit);

    if (rows.length === 0) {
      await bot.editMessageText('\u{1F4E6} Tidak ada server aktif.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'admin' }]] },
      });
      return;
    }

    let text = `\u{1F4E6} Server Aktif (${count} total)\n\n`;
    for (const t of rows) {
      const userName = t.User ? (t.User.name || t.User.username || t.User.telegram_id) : 'Unknown';
      const productName = t.Product ? t.Product.name : 'Unknown';
      const expires = t.expires_at ? formatDate(t.expires_at) : '-';
      text += `${t.invoice}\n\u{1F464} ${userName} | \u{1F4E6} ${productName}\n\u{23F3} Expired: ${expires}\n\n`;
    }

    const keyboard = { inline_keyboard: [] };
    for (const t of rows) {
      keyboard.inline_keyboard.push([
        { text: `\u{1F4C5} ${t.invoice}`, callback_data: `admin_extend_${t.id}` },
      ]);
    }
    const navRow = [];
    if (page > 0) navRow.push({ text: '\u{2B05}', callback_data: `admin_servers_${page - 1}` });
    if (page < totalPages - 1) navRow.push({ text: '\u{27A1}', callback_data: `admin_servers_${page + 1}` });
    if (navRow.length) keyboard.inline_keyboard.push(navRow);
    keyboard.inline_keyboard.push([{ text: '\u{1F519} Kembali', callback_data: 'admin' }]);

    await bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error('Error in handleAdminServers:', error);
  }
}

module.exports = {
  isAdmin, handleAdminMenu, handleAdminStats,
  handleAdminProducts, handleAdminProductAdd, handleAdminVpsAdd, handleAdminProductAddInput,
  handleAdminUsers, handleAdminUserAction,
  handleAdminTransactions,
  handleAdminServers,
};
