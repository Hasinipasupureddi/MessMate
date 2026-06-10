function getRequiredProductionSecrets() {
  return {
    jwtSecret: process.env.MESSMATE_JWT_SECRET || process.env.JWT_SECRET || '',
    bridgeSecret: process.env.SOCKET_BRIDGE_SECRET || process.env.MESSMATE_SOCKET_BRIDGE_SECRET || '',
  };
}

function validateStartupEnvironment() {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const missing = [];
  const secrets = getRequiredProductionSecrets();

  if (!secrets.jwtSecret) {
    missing.push('MESSMATE_JWT_SECRET');
  }

  if (!secrets.bridgeSecret) {
    missing.push('SOCKET_BRIDGE_SECRET');
  }

  if (missing.length > 0) {
    const error = new Error(`Missing required production environment variables: ${missing.join(', ')}`);
    error.code = 'MISSING_PRODUCTION_SECRETS';
    throw error;
  }
}

function getStartupSummary(socketServer) {
  return {
    environment: process.env.NODE_ENV || 'development',
    socketEnabled: Boolean(socketServer?.io),
    authMode: 'httpOnly-cookie',
    redisAdapterEnabled: Boolean(socketServer?.redisAdapterEnabled),
    healthEndpoints: ['/health', '/health/socket', '/health/db'],
  };
}

module.exports = {
  validateStartupEnvironment,
  getStartupSummary,
};