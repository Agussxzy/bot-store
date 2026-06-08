const { Product } = require('../models');
const { productListKeyboard, productDetailKeyboard } = require('../keyboards/productMenu');
const { formatRupiah } = require('../utils/formatter');
const logger = require('../utils/logger');

async function handleProductList(bot, chatId, messageId) {
  try {
    const products = await Product.findAll({ order: [['price', 'ASC']] });

    if (products.length === 0) {
      await bot.editMessageText('\u{274C} Belum ada produk tersedia.', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'home' }]] },
      });
      return;
    }

    await bot.editMessageText('\u{1F4E6} Silakan pilih paket panel:', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: productListKeyboard(products),
    });
  } catch (error) {
    logger.error('Error in handleProductList:', error);
  }
}

async function handleProductDetail(bot, chatId, messageId, productId) {
  try {
    const product = await Product.findByPk(productId);
    if (!product) {
      await bot.editMessageText('\u{274C} Produk tidak ditemukan.', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '\u{1F519} Kembali', callback_data: 'products' }]] },
      });
      return;
    }

    const text = `\u{1F4E6} ${product.name}

\u{1F7E2} RAM: ${product.ram} MB
\u{1F7E2} CPU: ${product.cpu}%
\u{1F7E2} Disk: ${product.disk} MB
\u{1F7E2} Harga: ${formatRupiah(product.price)}`;

    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: productDetailKeyboard(product.id),
    });
  } catch (error) {
    logger.error('Error in handleProductDetail:', error);
  }
}

module.exports = { handleProductList, handleProductDetail };
