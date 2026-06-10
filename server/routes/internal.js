const { Router } = require('express');
const { emitToRooms, SOCKET_EVENTS } = require('../socket');
const logger = require('../lib/logger');
const { createRequestId } = require('../socket/observability');

const router = Router();

function getExpectedSecret() {
  return process.env.SOCKET_BRIDGE_SECRET || process.env.MESSMATE_SOCKET_BRIDGE_SECRET || '';
}

router.post('/socket/emit', (req, res) => {
  const expectedSecret = getExpectedSecret();
  const providedSecret = String(req.headers['x-messmate-socket-secret'] || '').trim();
  const requestId = String(req.body?.requestId || createRequestId());
  const timestamp = String(req.body?.timestamp || new Date().toISOString());
  const sender = req.body?.sender || null;
  const targetRooms = Array.isArray(req.body?.rooms) && req.body.rooms.length > 0
    ? req.body.rooms
    : Array.isArray(req.body?.roles) && req.body.roles.length > 0
      ? req.body.roles.map((role) => `role:${role}`)
      : [];

  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
    logger.warn({ requestId, providedSecret: Boolean(providedSecret) }, 'unauthorized bridge request');
    return res.status(401).json({ message: 'Unauthorized bridge request.', requestId });
  }

  const { event, payload, rooms, roles } = req.body || {};
  if (!event || typeof event !== 'string') {
    return res.status(400).json({ message: 'event is required.', requestId });
  }

  try {
    emitToRooms(global.__messmateSocketServer?.io, event, payload, {
      rooms,
      roles,
      requestId,
      timestamp,
      sender,
      targetRooms,
    });
    logger.info({ requestId, event, rooms, roles, sender, targetRooms }, 'bridge emitted event');
    return res.json({ success: true, event, requestId });
  } catch (err) {
    logger.error({ requestId, err }, 'bridge emit failed');
    return res.status(500).json({ success: false, message: 'emit failed', requestId });
  }
});

router.get('/socket/health', (_req, res) => {
  res.json({
    ok: true,
    socketReady: Boolean(global.__messmateSocketServer?.io),
    events: Object.values(SOCKET_EVENTS),
    metrics: global.__messmateSocketMetrics || null,
  });
});

module.exports = router;
