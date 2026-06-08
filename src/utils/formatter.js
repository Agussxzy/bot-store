const moment = require('moment-timezone');

function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date) {
  return moment(date).tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm');
}

function generateInvoice() {
  const prefix = 'INV';
  const date = moment().tz('Asia/Jakarta').format('YYMMDD');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}/${date}/${random}`;
}

function generatePassword(length = 12) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

module.exports = { formatRupiah, formatDate, generateInvoice, generatePassword };
