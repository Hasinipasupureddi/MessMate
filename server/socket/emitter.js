const logger = require('../lib/logger');
const { createRequestId, decorateSocketPayload } = require('./observability');

// Simple emitter abstraction. Uses in-process Socket.IO by default.
// Later this module can be updated to use a Redis adapter or other transports.
function emit(io, eventName, payload, options = {}) {
  if (!io) {
    logger.warn('emit called without io instance');
    return;
  }

  const requestId = options.requestId || createRequestId();
  const timestamp = options.timestamp || new Date().toISOString();
  const decoratedPayload = decorateSocketPayload(eventName, payload, {
    requestId,
    timestamp,
    sender: options.sender,
    targetRooms: options.rooms,
  });

  // Default behavior: delegate to existing emitToRooms helper exported from socket index
  // The socket index exports an `emit` on global.__messmateSocketServer for backwards compat.
  try {
    if (global.__messmateSocketServer && typeof global.__messmateSocketServer.emit === 'function') {
      return global.__messmateSocketServer.emit(eventName, decoratedPayload, { ...options, requestId, timestamp });
    }

    // Fallback: emit directly to rooms if provided
    const rooms = Array.isArray(options.rooms) ? options.rooms : [];
    if (rooms.length > 0) {
      for (const r of rooms) {
        io.to(r).emit(eventName, decoratedPayload);
      }
      return;
    }

    // Otherwise broadcast to all
    io.emit(eventName, decoratedPayload);
  } catch (err) {
    logger.error({ err, requestId, event: eventName }, 'emitter error');
  }
}

module.exports = { emit };
