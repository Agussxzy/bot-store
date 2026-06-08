function vpsListKeyboard(products) {
  const rows = products.map(p => ([
    { text: `\u{1F7E2} ${p.name}`, callback_data: `vps_${p.id}` },
  ]));
  rows.push([{ text: '\u{1F519} Kembali', callback_data: 'home' }]);
  return { inline_keyboard: rows };
}

function vpsDetailKeyboard(productId) {
  return {
    inline_keyboard: [
      [{ text: '\u{1F4B3} Beli', callback_data: `vps_buy_${productId}` }],
      [{ text: '\u{1F519} Kembali', callback_data: 'vps' }],
    ],
  };
}

function vpsPaymentMethodKeyboard(invoice) {
  return {
    inline_keyboard: [
      [
        { text: '\u{1F4B3} Bayar via QRIS', callback_data: `vps_buy_qris_${invoice}` },
        { text: '\u{1F4B0} Bayar dengan Saldo', callback_data: `vps_buy_balance_${invoice}` },
      ],
      [{ text: '\u{1F519} Batal', callback_data: 'vps' }],
    ],
  };
}

function vpsPaymentKeyboard(invoice) {
  return {
    inline_keyboard: [
      [{ text: '\u{2705} Sudah Bayar', callback_data: `vps_check_${invoice}` }],
      [{ text: '\u{1F519} Batal', callback_data: 'vps' }],
    ],
  };
}

module.exports = { vpsListKeyboard, vpsDetailKeyboard, vpsPaymentMethodKeyboard, vpsPaymentKeyboard };
