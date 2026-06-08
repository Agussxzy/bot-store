const User = require('./User');
const Product = require('./Product');
const Transaction = require('./Transaction');
const Config = require('./Config');

User.hasMany(Transaction, { foreignKey: 'user_id' });
Transaction.belongsTo(User, { foreignKey: 'user_id' });

Product.hasMany(Transaction, { foreignKey: 'product_id' });
Transaction.belongsTo(Product, { foreignKey: 'product_id' });

module.exports = { User, Product, Transaction, Config };
