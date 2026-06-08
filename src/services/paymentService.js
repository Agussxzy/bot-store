const { Pakasir } = require('pakasir-sdk');
const { Config } = require('../models');
require('dotenv').config();

const pakasir = new Pakasir({
  slug: process.env.PAKASIR_SLUG,
  apikey: process.env.PAKASIR_APIKEY,
});

async function getConfig(key, defaultValue = null) {
  const cfg = await Config.findOne({ where: { key } });
  return cfg ? cfg.value : defaultValue;
}

async function setConfig(key, value) {
  const [cfg] = await Config.findOrCreate({ where: { key }, defaults: { value } });
  cfg.value = String(value);
  await cfg.save();
  return cfg;
}

async function createPayment(invoice, amount) {
  return pakasir.createPayment('qris', invoice, amount);
}

async function checkPayment(invoice, amount) {
  return pakasir.detailPayment(invoice, amount);
}

async function simulatePayment(invoice, amount) {
  return pakasir.simulationPayment(invoice, amount);
}

module.exports = {
  getConfig, setConfig,
  createPayment, checkPayment, simulatePayment,
};
