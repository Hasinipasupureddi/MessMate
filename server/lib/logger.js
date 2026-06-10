let logger;
try {
  const pino = require('pino');
  logger = pino({ level: process.env.LOG_LEVEL || 'info', timestamp: pino.stdTimeFunctions.isoTime });
} catch (err) {
  // fallback to console
  logger = {
    info: (...args) => console.log('[info]', ...args),
    warn: (...args) => console.warn('[warn]', ...args),
    error: (...args) => console.error('[error]', ...args),
    debug: (...args) => console.log('[debug]', ...args),
  };
}

module.exports = logger;
