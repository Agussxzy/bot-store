function productListKeyboard(products) {
  const rows = products.map(p => ([
    { text: `\u{1F7E2} ${p.name}`, callback_data: `product_${p.id}` },
  ]));
  rows.push([{ text: '\u{1F519} Kembali', callback_data: 'home' }]);
  return { inline_keyboard: rows };
}

function productDetailKeyboard(productId) {
  return {
    inline_keyboard: [
      [{ text: '\u{1F4B3} Beli', callback_data: `buy_${productId}` }],
      [{ text: '\u{1F519} Kembali', callback_data: 'products' }],
    ],
  };
}

async function paymentMethodKeyboard(productId) {
  const { getConfig } = require('../services/paymentService');
  const raw = await getConfig('payment_methods');
  const methods = raw ? JSON.parse(raw) : { qris: true, balance: true, manual_qris: true };

  const rows = [];
  if (methods.qris) rows.push([{ text: '\u{1F4B3} Bayar via QRIS', callback_data: `buy_qris_${productId}` }]);
  if (methods.balance) rows.push([{ text: '\u{1F4B0} Bayar dengan Saldo', callback_data: `buy_balance_${productId}` }]);
  if (methods.manual_qris) rows.push([{ text: '\u{1F5BC} Manual QRIS', callback_data: `buy_manual_${productId}` }]);
  if (rows.length) rows.push([{ text: '\u{1F519} Kembali', callback_data: 'products' }]);
  return { inline_keyboard: rows };
}

function paymentQrKeyboard(invoice) {
  return {
    inline_keyboard: [
      [{ text: '\u{2705} Sudah Bayar', callback_data: `check_${invoice}` }],
      [{ text: '\u{1F519} Batal', callback_data: 'products' }],
    ],
  };
}

function topupPaymentKeyboard(invoice) {
  return {
    inline_keyboard: [
      [{ text: '\u{2705} Sudah Bayar', callback_data: `topup_check_${invoice}` }],
      [{ text: '\u{1F519} Batal', callback_data: 'home' }],
    ],
  };
}

module.exports = { productListKeyboard, productDetailKeyboard, paymentMethodKeyboard, paymentQrKeyboard, topupPaymentKeyboard };
