const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  ram: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  cpu: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  disk: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  price: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  duration_days: {
    type: DataTypes.INTEGER,
    defaultValue: 30,
  },
  type: {
    type: DataTypes.ENUM('panel', 'vps'),
    defaultValue: 'panel',
  },
  metadata: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'products',
});

module.exports = Product;
