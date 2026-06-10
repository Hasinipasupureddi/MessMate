const { Router } = require('express');
const os = require('os');
const pool = require('../config/db');
const logger = require('../lib/logger');
const { getSocketMetricsSnapshot } = require('../socket/observability');

const router = Router();

function getEnvSummary() {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    socketBridgeConfigured: Boolean(process.env.SOCKET_BRIDGE_SECRET || process.env.MESSMATE_SOCKET_BRIDGE_SECRET),
  };
}

router.get('/', (_req, res) => {
  const uptime = process.uptime();
  res.json({ ok: true, service: 'messmate-socket-server', uptime, env: getEnvSummary() });
});

router.get('/socket', async (_req, res) => {
  try {
    const socketServer = global.__messmateSocketServer;
    const clients = socketServer?.io?.engine?.clientsCount || 0;
    const namespace = socketServer?.io?.of ? socketServer.io.of('/') : null;
    const roomsCount = namespace?.adapter?.rooms && namespace?.adapter?.sids
      ? Array.from(namespace.adapter.rooms.keys()).filter((room) => !namespace.adapter.sids.has(room)).length
      : 0;
    const mem = process.memoryUsage();
    const metrics = getSocketMetricsSnapshot();
    res.json({
      ok: true,
      socketReady: Boolean(global.__messmateSocketServer?.io),
      events: require('../socket/events').SOCKET_EVENTS ? Object.values(require('../socket/events').SOCKET_EVENTS) : [],
      uptime: process.uptime(),
      activeClients: clients,
      summary: {
        activeSockets: clients,
        roomsCount,
        reconnectCount: metrics.reconnectCount,
        rejectedConnections: metrics.rejectedConnections,
        rateLimitedEmits: metrics.rateLimitedEmits,
      },
      memory: mem,
      env: getEnvSummary(),
      metrics,
    });
  } catch (err) {
    logger.error('health/socket error', err);
    res.status(500).json({ ok: false, error: 'socket health check failed' });
  }
});

router.get('/db', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 as ok');
    res.json({ ok: true, db: Array.isArray(rows) ? rows[0] : rows, uptime: process.uptime() });
  } catch (err) {
    logger.error('health/db error', err);
    res.status(500).json({ ok: false, error: 'db connectivity failed' });
  }
});

module.exports = router;
