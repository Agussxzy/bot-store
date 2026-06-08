function adminMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '\u{1F4CA} Statistik', callback_data: 'admin_stats' }],
      [{ text: '\u{1F4E6} Kelola Produk', callback_data: 'admin_products_0' }],
      [{ text: '\u{1F465} Kelola User', callback_data: 'admin_users_0' }],
      [{ text: '\u{1F4B0} Transaksi', callback_data: 'admin_transactions_0' }],
      [{ text: '\u{1F519} Kembali', callback_data: 'home' }],
    ],
  };
}

function adminProductManageKeyboard(page, totalPages) {
  const row = [];
  if (page > 0) row.push({ text: '\u{2B05}', callback_data: `admin_products_${page - 1}` });
  if (page < totalPages - 1) row.push({ text: '\u{27A1}', callback_data: `admin_products_${page + 1}` });
  return {
    inline_keyboard: [
      [
        { text: '\u{2795} Tambah Panel', callback_data: 'admin_product_add' },
        { text: '\u{2795} Tambah VPS', callback_data: 'admin_vps_add' },
      ],
      row.length ? row : [],
      [{ text: '\u{1F519} Kembali', callback_data: 'admin' }],
    ],
  };
}

function adminUserManageKeyboard(page, totalPages) {
  const row = [];
  if (page > 0) row.push({ text: '\u{2B05}', callback_data: `admin_users_${page - 1}` });
  if (page < totalPages - 1) row.push({ text: '\u{27A1}', callback_data: `admin_users_${page + 1}` });
  return {
    inline_keyboard: [
      [{ text: '\u{1F50D} Cari User', callback_data: 'admin_user_search' }],
      row.length ? row : [],
      [{ text: '\u{1F519} Kembali', callback_data: 'admin' }],
    ],
  };
}

function adminUserActionKeyboard(userId) {
  return {
    inline_keyboard: [
      [
        { text: '\u{26D4} Ban', callback_data: `admin_user_ban_${userId}` },
        { text: '\u{2705} Unban', callback_data: `admin_user_unban_${userId}` },
      ],
      [
        { text: '\u{2795} Tambah Saldo', callback_data: `admin_user_addbal_${userId}` },
        { text: '\u{2796} Kurangi Saldo', callback_data: `admin_user_subbal_${userId}` },
      ],
      [{ text: '\u{1F519} Kembali', callback_data: 'admin_users_0' }],
    ],
  };
}

module.exports = { adminMenuKeyboard, adminProductManageKeyboard, adminUserManageKeyboard, adminUserActionKeyboard };
