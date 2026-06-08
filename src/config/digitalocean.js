const axios = require('axios');
require('dotenv').config();

const digitalocean = axios.create({
  baseURL: 'https://api.digitalocean.com/v2',
  headers: {
    'Authorization': `Bearer ${process.env.DIGITALOCEAN_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

module.exports = digitalocean;
