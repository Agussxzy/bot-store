const axios = require('axios');
require('dotenv').config();

const pterodactyl = axios.create({
  baseURL: process.env.PTERODACTYL_URL,
  headers: {
    'Authorization': `Bearer ${process.env.PTERODACTYL_PTLA}`,
    'Accept': 'Application/vnd.pterodactyl.v1+json',
    'Content-Type': 'application/json',
  },
});

module.exports = pterodactyl;
