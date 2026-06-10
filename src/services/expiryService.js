const cron = require('node-cron');
const { Op } = require('sequelize');
const { Transaction, User } = require('../models');
const pterodactylService = require('./pterodactylService');
const logger = require('../utils/logger');
const { formatDate } = require('../utils/formatter');

async function checkExpiredServers(bot) {
  const expired = await Transaction.findAll({
    where: {
      status: 'success',
      type: 'purchase',
      server_id: { [Op.ne]: null },
      expires_at: { [Op.ne]: null, [Op.lte]: new Date() },
    },
    include: [User],
  });

  for (const tx of expired) {
    try {
      await pterodactylService.deletePterodactylServer(tx.server_id);
    } catch (err) {
      logger.warn(`Gagal hapus server ${tx.server_id}: ${err.message}`);
    }

    await tx.update({ status: 'expired' });

    try {
      const chatId = parseInt(tx.User.telegram_id);
      await bot.sendMessage(chatId, `\u{274C} Server Panel Anda telah expired!\n\nInvoice: ${tx.invoice}\nServer ID: ${tx.server_id}\n\nSilakan hubungi admin untuk perpanjangan.`, {
        reply_markup: { inline_keyboard: [[{ text: '\u{1F3E0} Menu Utama', callback_data: 'home' }]] },
      });
    } catch (err) {
      logger.warn(`Gagal notifikasi user ${tx.User.telegram_id}: ${err.message}`);
    }

    logger.info(`Server ${tx.server_id} expired: ${tx.invoice}`);
  }
}

async function checkExpiringSoonServers(bot) {
  const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const expiring = await Transaction.findAll({
    where: {
      status: 'success',
      type: 'purchase',
      server_id: { [Op.ne]: null },
      expires_at: { [Op.ne]: null, [Op.lte]: soon, [Op.gte]: new Date() },
    },
    include: [User],
  });

  for (const tx of expiring) {
    const meta = tx.metadata ? JSON.parse(tx.metadata) : {};
    if (meta.expiry_warned) continue;

    meta.expiry_warned = true;
    await tx.update({ metadata: JSON.stringify(meta) });

    try {
      const chatId = parseInt(tx.User.telegram_id);
      await bot.sendMessage(chatId, `\u{26A0} Server Panel Anda akan expired dalam 1 hari!\n\nInvoice: ${tx.invoice}\nServer ID: ${tx.server_id}\nExpired: ${formatDate(tx.expires_at)}\n\nLakukan perpanjangan sebelum expired.`, {
        reply_markup: { inline_keyboard: [[{ text: '\u{1F3E0} Menu Utama', callback_data: 'home' }]] },
      });
    } catch (err) {
      logger.warn(`Gagal notifikasi user ${tx.User.telegram_id}: ${err.message}`);
    }
  }
}

function startExpiryChecker(bot) {
  cron.schedule('0 * * * *', () => {
    checkExpiredServers(bot);
    checkExpiringSoonServers(bot);
  });
  logger.info('Expiry checker started (hourly)');
}

module.exports = { startExpiryChecker };
