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

function paymentQrKeyboard(invoice) {
  return {
    inline_keyboard: [
      [{ text: '\u{2705} Sudah Bayar', callback_data: `check_${invoice}` }],
      [{ text: '\u{1F519} Batal', callback_data: 'products' }],
    ],
  };
}

module.exports = { productListKeyboard, productDetailKeyboard, paymentQrKeyboard };
