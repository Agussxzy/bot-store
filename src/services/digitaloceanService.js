const doApi = require('../config/digitalocean');
const logger = require('../utils/logger');

async function createDroplet(name, sizeSlug, password) {
  try {
    const region = process.env.DO_REGION_SLUG || 'sgp1';
    const image = process.env.DO_IMAGE_SLUG || 'ubuntu-24-04-x64';

    const userData = `#cloud-config
password: ${password}
chpasswd:
  expire: False
ssh_pwauth: true`;

    const { data } = await doApi.post('/droplets', {
      name,
      region,
      size: sizeSlug,
      image,
      user_data: userData,
      monitoring: true,
      tags: ['bot-panel'],
    });

    logger.info(`Droplet creation initiated: ${name}`);
    return data.droplet;
  } catch (error) {
    logger.error('Failed to create Droplet:', error.response?.data || error.message);
    throw new Error('Gagal membuat VPS di DigitalOcean');
  }
}

async function getDroplet(dropletId) {
  try {
    const { data } = await doApi.get(`/droplets/${dropletId}`);
    return data.droplet;
  } catch (error) {
    logger.error('Failed to get Droplet:', error.response?.data || error.message);
    return null;
  }
}

async function waitForDropletActive(dropletId, maxRetries = 30, interval = 10000) {
  for (let i = 0; i < maxRetries; i++) {
    const droplet = await getDroplet(dropletId);
    if (!droplet) return null;
    if (droplet.status === 'active') {
      const ipv4 = droplet.networks?.v4?.find(n => n.type === 'public')?.ip_address;
      return { id: droplet.id, ip: ipv4, status: droplet.status };
    }
    await new Promise(r => setTimeout(r, interval));
  }
  return null;
}

async function deleteDroplet(dropletId) {
  try {
    await doApi.delete(`/droplets/${dropletId}`);
    logger.info(`Droplet ${dropletId} deleted`);
  } catch (error) {
    logger.error('Failed to delete Droplet:', error.response?.data || error.message);
    throw new Error('Gagal menghapus VPS');
  }
}

module.exports = { createDroplet, getDroplet, waitForDropletActive, deleteDroplet };
