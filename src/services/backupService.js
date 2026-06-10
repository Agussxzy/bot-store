const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const AdmZip = require('adm-zip');
const axios = require('axios');
const logger = require('../utils/logger');

const PROJECT_ROOT = path.join(__dirname, '../..');
const BOT_TOKEN = process.env.BOT_TOKEN;

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatTimestamp(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

async function createBackupZip() {
  const ts = formatTimestamp();
  const zipPath = path.join(os.tmpdir(), `backup_${ts}.zip`);
  const zip = new AdmZip();

  const dbPath = path.join(PROJECT_ROOT, 'database.sqlite');
  if (fs.existsSync(dbPath)) {
    zip.addLocalFile(dbPath, '', 'database.sqlite');
  }

  const envPath = path.join(PROJECT_ROOT, '.env');
  if (fs.existsSync(envPath)) {
    zip.addLocalFile(envPath, '', '.env');
  }

  zip.writeZip(zipPath);
  return { zipPath, ts };
}

function startBackupScheduler(bot) {
  const adminId = parseInt(process.env.ADMIN_ID);
  if (!adminId) return;

  cron.schedule('0 3 * * *', async () => {
    try {
      const { zipPath, ts } = await createBackupZip();
      await bot.sendDocument(adminId, zipPath, { caption: `\u{1F4BE} Backup otomatis: ${ts}` });
      fs.unlinkSync(zipPath);
      logger.info(`Auto backup sent: ${ts}`);
    } catch (err) {
      logger.error('Auto backup failed:', err);
    }
  });
  logger.info('Backup scheduler started (daily at 03:00)');
}

async function handleAdminBackup(bot, chatId, messageId) {
  const text = `\u{1F4BE} Backup & Restore

Pilih aksi:`;
  await bot.editMessageText(text, {
    chat_id: chatId, message_id: messageId,
    reply_markup: {
      inline_keyboard: [
        [{ text: '\u{2795} Buat Backup', callback_data: 'admin_backup_create' }],
        [{ text: '\u{1F4E5} Restore', callback_data: 'admin_backup_restore' }],
        [{ text: '\u{1F519} Kembali', callback_data: 'admin' }],
      ],
    },
  });
}

async function handleAdminBackupCreate(bot, chatId, messageId) {
  try {
    await bot.editMessageText('\u{23F3} Membuat backup...', {
      chat_id: chatId, message_id: messageId,
    });

    const { zipPath, ts } = await createBackupZip();
    await bot.sendDocument(chatId, zipPath, { caption: `\u{1F4BE} Backup: ${ts}` });
    fs.unlinkSync(zipPath);

    await bot.editMessageText(`\u{2705} Backup berhasil dibuat!\n\nFile backup telah dikirim ke chat ini.`, {
      chat_id: chatId, message_id: messageId,
      reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'admin_backup' }]] },
    });
  } catch (err) {
    logger.error('Backup creation error:', err);
    await bot.editMessageText('\u{274C} Gagal membuat backup.', {
      chat_id: chatId, message_id: messageId,
      reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'admin_backup' }]] },
    });
  }
}

async function handleAdminRestoreInit(bot, chatId, messageId) {
  await bot.editMessageText(`\u{1F4E5} Restore Backup

Kirim file backup (.zip) yang sebelumnya kamu terima dari bot.

\u{26A0} Peringatan: Semua data saat ini akan ditimpa dan bot akan restart!`, {
    chat_id: chatId, message_id: messageId,
    reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Batal', callback_data: 'admin_backup' }]] },
  });
}

async function restoreFromZip(bot, chatId, fileId) {
  const statusMsg = await bot.sendMessage(chatId, '\u{23F3} Mengunduh dan merestore...');
  const statusMsgId = statusMsg.message_id;

  try {
    const file = await bot.getFile(fileId);
    const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
    const response = await axios({ url, method: 'GET', responseType: 'arraybuffer' });

    const tmpDir = path.join(os.tmpdir(), `restore_${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const zipPath = path.join(tmpDir, 'backup.zip');
    fs.writeFileSync(zipPath, Buffer.from(response.data));

    const zip = new AdmZip(zipPath);
    zip.extractAllTo(tmpDir, true);

    const dbSrc = path.join(tmpDir, 'database.sqlite');
    const envSrc = path.join(tmpDir, '.env');

    if (fs.existsSync(dbSrc)) {
      fs.copyFileSync(dbSrc, path.join(PROJECT_ROOT, 'database.sqlite'));
    }
    if (fs.existsSync(envSrc)) {
      fs.copyFileSync(envSrc, path.join(PROJECT_ROOT, '.env'));
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });

    await bot.editMessageText(`\u{2705} Restore berhasil!\n\nBot akan restart dalam 3 detik...`, {
      chat_id: chatId, message_id: statusMsgId,
    });

    setTimeout(() => process.exit(0), 3000);
  } catch (err) {
    logger.error('Restore error:', err);
    await bot.editMessageText('\u{274C} Gagal restore. Pastikan file backup valid.', {
      chat_id: chatId, message_id: statusMsgId,
    }).catch(() => {});
  }
}

module.exports = {
  createBackupZip, startBackupScheduler,
  handleAdminBackup, handleAdminBackupCreate, handleAdminRestoreInit, restoreFromZip,
};
