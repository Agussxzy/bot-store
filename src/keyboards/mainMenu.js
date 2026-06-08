function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '\u{1F6D2} Beli Panel', callback_data: 'products' }],
      [{ text: '\u{1F5A5} Beli VPS', callback_data: 'vps' }],
      [{ text: '\u{1F464} Profil', callback_data: 'profile' }],
      [
        { text: '\u{1F4DC} Riwayat', callback_data: 'history_0' },
        { text: '\u{1F4DE} Bantuan', callback_data: 'help' },
      ],
    ],
  };
}

function backToMainMenu() {
  return {
    inline_keyboard: [
      [{ text: '\u{1F519} Kembali', callback_data: 'home' }],
    ],
  };
}

module.exports = { mainMenuKeyboard, backToMainMenu };
