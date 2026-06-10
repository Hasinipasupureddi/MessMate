const logger = require('../lib/logger');

function maybeConfigureRedisAdapter(io) {
  if (process.env.SOCKET_REDIS_ENABLED !== 'true') {
    return false;
  }

  logger.info({ enabled: false, reason: 'redis adapter scaffold only' }, '[messmate][socket] redis adapter disabled by default');
  return false;
}

module.exports = { maybeConfigureRedisAdapter };