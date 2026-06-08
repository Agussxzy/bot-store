const moment = require('moment-timezone');

const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.INFO;

function timestamp() {
  return moment().tz('Asia/Jakarta').format('DD/MM/YY HH:mm:ss');
}

const logger = {
  error: (...args) => {
    if (currentLevel >= LOG_LEVELS.ERROR) console.error(`[${timestamp()}] [ERROR]`, ...args);
  },
  warn: (...args) => {
    if (currentLevel >= LOG_LEVELS.WARN) console.warn(`[${timestamp()}] [WARN]`, ...args);
  },
  info: (...args) => {
    if (currentLevel >= LOG_LEVELS.INFO) console.log(`[${timestamp()}] [INFO]`, ...args);
  },
  debug: (...args) => {
    if (currentLevel >= LOG_LEVELS.DEBUG) console.log(`[${timestamp()}] [DEBUG]`, ...args);
  },
};

module.exports = logger;
