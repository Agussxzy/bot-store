const { User, Transaction } = require('../models');

async function findOrCreateUser(telegramId, username, name) {
  const [user, created] = await User.findOrCreate({
    where: { telegram_id: String(telegramId) },
    defaults: { username, name },
  });
  if (!created) {
    const updates = {};
    if (username) updates.username = username;
    if (name) updates.name = name;
    if (Object.keys(updates).length) await user.update(updates);
  }
  return user;
}

async function getUserById(id) {
  return User.findByPk(id);
}

async function getUserByTelegramId(telegramId) {
  return User.findOne({ where: { telegram_id: String(telegramId) } });
}

async function getAllUsers(page = 0, limit = 10) {
  const { rows, count } = await User.findAndCountAll({
    order: [['created_at', 'DESC']],
    offset: page * limit,
    limit,
  });
  return { users: rows, total: count, totalPages: Math.ceil(count / limit) };
}

async function addBalance(userId, amount) {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');
  user.balance += amount;
  await user.save();
  return user;
}

async function subtractBalance(userId, amount) {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');
  if (user.balance < amount) throw new Error('Saldo tidak mencukupi');
  user.balance -= amount;
  await user.save();
  return user;
}

async function banUser(userId) {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');
  user.is_banned = true;
  await user.save();
  return user;
}

async function unbanUser(userId) {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');
  user.is_banned = false;
  await user.save();
  return user;
}

async function searchUsers(query) {
  return User.findAll({
    where: {
      [require('sequelize').Op.or]: [
        { username: { [require('sequelize').Op.like]: `%${query}%` } },
        { name: { [require('sequelize').Op.like]: `%${query}%` } },
        { telegram_id: { [require('sequelize').Op.like]: `%${query}%` } },
      ],
    },
    limit: 20,
  });
}

module.exports = {
  findOrCreateUser, getUserById, getUserByTelegramId, getAllUsers,
  addBalance, subtractBalance, banUser, unbanUser, searchUsers,
};
