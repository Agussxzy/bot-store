const pterodactyl = require('../config/pterodactyl');
const logger = require('../utils/logger');

async function createPterodactylUser(email, username, password) {
  try {
    const { data } = await pterodactyl.post('/api/application/users', {
      email,
      username,
      first_name: username,
      last_name: 'Panel',
      password,
      language: 'en',
    });
    logger.info(`Pterodactyl user created: ${username}`);
    return data.attributes;
  } catch (error) {
    logger.error('Failed to create Pterodactyl user:', error.response?.data || error.message);
    throw new Error('Gagal membuat user Pterodactyl');
  }
}

async function createPterodactylServer(userId, product) {
  try {
    const eggId = process.env.PTERODACTYL_EGG_ID;

    const payload = {
      name: `Panel-${product.name}-${Date.now()}`,
      user: userId,
      egg: parseInt(eggId),
      limits: {
        memory: product.ram,
        swap: 0,
        disk: product.disk,
        io: 500,
        cpu: product.cpu,
      },
      feature_limits: {
        databases: 0,
        allocations: 1,
        backups: 0,
      },
    };

    if (process.env.DEFAULT_ALLOCATION_ID) {
      payload.allocation = {
        default: parseInt(process.env.DEFAULT_ALLOCATION_ID),
      };
    } else {
      payload.deploy = {
        locations: [parseInt(process.env.DEFAULT_LOCATION_ID || 1)],
        dedicated_ip: false,
        port_range: [],
      };
    }

    const { data } = await pterodactyl.post('/api/application/servers', payload);

    logger.info(`Pterodactyl server created for user ${userId}`);
    return data.attributes;
  } catch (error) {
    logger.error('Failed to create Pterodactyl server:', error.response?.data || error.message);
    throw new Error('Gagal membuat server Pterodactyl');
  }
}

async function getPterodactylUserByEmail(email) {
  try {
    const { data } = await pterodactyl.get('/api/application/users', {
      params: { 'filter[email]': email },
    });
    return data.data?.[0]?.attributes || null;
  } catch (error) {
    logger.error('Failed to get Pterodactyl user:', error.response?.data || error.message);
    return null;
  }
}

async function deletePterodactylServer(serverId) {
  try {
    await pterodactyl.delete(`/api/application/servers/${serverId}`, {
      params: { force: true },
    });
    logger.info(`Pterodactyl server ${serverId} deleted`);
  } catch (error) {
    logger.error('Failed to delete Pterodactyl server:', error.response?.data || error.message);
    throw new Error('Gagal menghapus server Pterodactyl');
  }
}

module.exports = {
  createPterodactylUser, createPterodactylServer,
  getPterodactylUserByEmail, deletePterodactylServer,
};
