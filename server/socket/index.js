const { Server } = require('socket.io');
const { verifySocketSession } = require('./auth');
const { ROLE_ROOMS, SOCKET_EVENTS } = require('./events');
const logger = require('../lib/logger');
const {
  createRequestId,
  decorateSocketPayload,
  getSocketMetricsSnapshot,
  recordAuthFailure,
  recordConnection,
  recordDisconnect,
  recordPingLatency,
  markSocketActivity,
  recordRateLimitedEmit,
  cleanupStaleSockets,
  detectListenerLeak,
  ensureSocketMetrics,
} = require('./observability');
const { maybeConfigureRedisAdapter } = require('./redisAdapter');

const ROLE_ROOM_BY_NAME = {
  student: ROLE_ROOMS.student,
  staff: ROLE_ROOMS.staff,
  warden: ROLE_ROOMS.warden,
};


function getCorsOrigin() {
  return process.env.SOCKET_CORS_ORIGIN || process.env.NEXT_PUBLIC_SOCKET_URL || 'http://127.0.0.1:4028';
}

function getSocketSecret() {
  return process.env.SOCKET_BRIDGE_SECRET || process.env.MESSMATE_SOCKET_BRIDGE_SECRET || '';
}

function getDefaultTargetRooms(eventName, payload) {
  switch (eventName) {
    case SOCKET_EVENTS.complaintCreated:
    case SOCKET_EVENTS.complaintUpdated:
      return [ROLE_ROOM_BY_NAME.staff, ROLE_ROOM_BY_NAME.warden, payload?.studentId ? `user:${payload.studentId}` : null].filter(Boolean);
    case SOCKET_EVENTS.mealVotesSubmitted:
    case SOCKET_EVENTS.mealOptinsUpdated:
      return [ROLE_ROOM_BY_NAME.student, ROLE_ROOM_BY_NAME.staff, ROLE_ROOM_BY_NAME.warden];
    case SOCKET_EVENTS.attendanceUpdated:
    case SOCKET_EVENTS.analyticsRefresh:
    case SOCKET_EVENTS.dashboardRefresh:
      return [ROLE_ROOM_BY_NAME.staff, ROLE_ROOM_BY_NAME.warden];
    case SOCKET_EVENTS.notificationsUpdated:
      return [payload?.userId ? `user:${payload.userId}` : null, ROLE_ROOM_BY_NAME.staff, ROLE_ROOM_BY_NAME.warden].filter(Boolean);
    default:
      return [ROLE_ROOM_BY_NAME.student, ROLE_ROOM_BY_NAME.staff, ROLE_ROOM_BY_NAME.warden];
  }
}

function emitToRooms(io, eventName, payload, options = {}) {
  const rooms = Array.isArray(options.rooms) && options.rooms.length > 0
    ? options.rooms
    : options.roles && options.roles.length > 0
      ? options.roles.map((role) => ROLE_ROOM_BY_NAME[role]).filter(Boolean)
      : getDefaultTargetRooms(eventName, payload);

  const uniqueRooms = [...new Set(rooms.filter(Boolean))];
  const requestId = options.requestId || createRequestId();
  const timestamp = options.timestamp || new Date().toISOString();
  const decoratedPayload = decorateSocketPayload(eventName, payload, {
    requestId,
    timestamp,
    sender: options.sender,
    targetRooms: uniqueRooms,
  });

  const metrics = ensureSocketMetrics();
  metrics.lastHeartbeatAt = timestamp;
  metrics.recentEvents = [...metrics.recentEvents.slice(-99), {
    event: eventName,
    requestId,
    sender: options.sender,
    targetRooms: uniqueRooms,
    timestamp,
  }];

  for (const room of uniqueRooms) {
    io.to(room).emit(eventName, decoratedPayload);
  }
}

function isAuthorizedRoomJoin(session, roomName) {
  if (typeof roomName !== 'string' || !roomName.trim()) {
    return false;
  }

  const trimmedRoom = roomName.trim();
  const allowedRooms = new Set([
    `user:${session.sub}`,
    ROLE_ROOM_BY_NAME[session.role],
    `hostel:${session.hostelId}`,
  ]);

  return allowedRooms.has(trimmedRoom);
}

function withSocketActivity(socket, eventName, handler) {
  return (...args) => {
    if (!markSocketActivity(socket, eventName)) {
      recordRateLimitedEmit(socket, eventName);
      logger.warn({ socketId: socket.id, userId: socket.data?.session?.sub, role: socket.data?.session?.role, event: eventName }, '[messmate][socket] client rate limited');
      socket.disconnect(true);
      return;
    }

    socket.data.lastRequestId = args?.[0]?.requestId || socket.data.lastRequestId || createRequestId();
    detectListenerLeak(socket, eventName);
    handler(...args);
  };
}

function initializeSocketServer(httpServer) {
  if (global.__messmateSocketServer) {
    return global.__messmateSocketServer;
  }

  const io = new Server(httpServer, {
    cors: {
      origin: getCorsOrigin(),
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  logger.info({ corsOrigin: getCorsOrigin(), hasSecret: Boolean(getSocketSecret()) }, '[messmate][socket] initialized');
  const redisAdapterEnabled = maybeConfigureRedisAdapter(io);

  io.use((socket, next) => {
    const session = verifySocketSession(socket);
    if (!session) {
      recordAuthFailure('socket_handshake');
      next(new Error('Unauthorized'));
      return;
    }

    socket.data.session = session;
    next();
  });

  io.on('connection', (socket) => {
    const session = socket.data.session;
    socket.join(`user:${session.sub}`);
    socket.join(ROLE_ROOM_BY_NAME[session.role]);
    socket.join(`hostel:${session.hostelId}`);

    recordConnection(io, socket, session);
    logger.info({ socketId: socket.id, userId: session.sub, role: session.role, hostelId: session.hostelId, clients: io.engine.clientsCount }, '[messmate][socket] client connected');

    socket.emit('socket:ready', {
      userId: session.sub,
      role: session.role,
      hostelId: session.hostelId,
      requestId: createRequestId(),
      event: 'socket:ready',
      timestamp: new Date().toISOString(),
      sender: {
        userId: session.sub,
        role: session.role,
        hostelId: session.hostelId,
      },
    });

    socket.on(SOCKET_EVENTS.devPing, withSocketActivity(socket, SOCKET_EVENTS.devPing, (payload = {}) => {
      const requestId = String(payload.requestId || createRequestId());
      const clientTimestamp = payload.clientTimestamp ? new Date(payload.clientTimestamp).getTime() : NaN;
      if (!Number.isNaN(clientTimestamp)) {
        recordPingLatency(Date.now() - clientTimestamp);
      }
      socket.emit(SOCKET_EVENTS.devPong, {
        socketId: socket.id,
        receivedAt: new Date().toISOString(),
        requestId,
        event: SOCKET_EVENTS.devPong,
        sender: {
          userId: session.sub,
          role: session.role,
          hostelId: session.hostelId,
        },
        ...payload,
      });
    }));

    socket.on(SOCKET_EVENTS.devInspect, withSocketActivity(socket, SOCKET_EVENTS.devInspect, (payload = {}) => {
      const requestId = String(payload.requestId || createRequestId());
      socket.emit(SOCKET_EVENTS.devInspectResult, {
        socketId: socket.id,
        role: session.role,
        userId: session.sub,
        hostelId: session.hostelId,
        rooms: Array.from(socket.rooms),
        activeClients: io.engine.clientsCount,
        transport: socket.conn?.transport?.name || 'unknown',
        requestId,
        event: SOCKET_EVENTS.devInspectResult,
        timestamp: new Date().toISOString(),
        sender: {
          userId: session.sub,
          role: session.role,
          hostelId: session.hostelId,
        },
      });
    }));

    socket.on(SOCKET_EVENTS.devTestNotification, withSocketActivity(socket, SOCKET_EVENTS.devTestNotification, (payload = {}) => {
      emitToRooms(io, SOCKET_EVENTS.notificationsUpdated, {
        userId: payload.userId || session.sub,
        message: payload.message || 'Diagnostics notification',
        severity: payload.severity || 'info',
      }, {
        rooms: payload.rooms || [`user:${payload.userId || session.sub}`],
      });
    }));

    socket.on(SOCKET_EVENTS.devTestComplaint, withSocketActivity(socket, SOCKET_EVENTS.devTestComplaint, (payload = {}) => {
      emitToRooms(io, SOCKET_EVENTS.complaintCreated, {
        studentId: payload.studentId || session.sub,
        complaint: payload.complaint || {
          id: `dev-complaint-${Date.now()}`,
          studentId: payload.studentId || session.sub,
          category: payload.category || 'mess',
          complaintText: payload.complaintText || 'Diagnostics complaint',
          status: 'open',
        },
      }, {
        roles: ['staff', 'warden'],
      });
    }));

    socket.on(SOCKET_EVENTS.devTestVote, withSocketActivity(socket, SOCKET_EVENTS.devTestVote, (payload = {}) => {
      emitToRooms(io, SOCKET_EVENTS.mealVotesSubmitted, {
        studentId: payload.studentId || session.sub,
        voteDate: payload.voteDate || new Date().toISOString().slice(0, 10),
        votes: payload.votes || [
          {
            mealType: 'lunch',
            dishName: 'Diagnostics dish',
          },
        ],
      }, {
        roles: ['student', 'staff', 'warden'],
      });
    }));

    socket.on('room:join', withSocketActivity(socket, 'room:join', (roomName) => {
      if (!isAuthorizedRoomJoin(session, roomName)) {
        logger.warn({ socketId: socket.id, userId: session.sub, role: session.role, roomName }, '[messmate][socket] unauthorized room join rejected');
        return;
      }

      socket.join(roomName.trim());
    }));

    socket.on('room:leave', withSocketActivity(socket, 'room:leave', (roomName) => {
      if (!isAuthorizedRoomJoin(session, roomName)) {
        logger.warn({ socketId: socket.id, userId: session.sub, role: session.role, roomName }, '[messmate][socket] unauthorized room leave rejected');
        return;
      }

      socket.leave(roomName.trim());
    }));

    socket.on('disconnect', (reason) => {
      recordDisconnect(io, socket, session, reason);
      logger.info({ socketId: socket.id, userId: session.sub, role: session.role, reason, clients: io.engine.clientsCount }, '[messmate][socket] client disconnected');
    });
  });

  global.__messmateSocketServer = {
    io,
    emit: (eventName, payload, options = {}) => emitToRooms(io, eventName, payload, options),
    secret: getSocketSecret(),
    metrics: getSocketMetricsSnapshot,
    cleanupStaleSockets: () => cleanupStaleSockets(io),
    redisAdapterEnabled,
  };

  if (!global.__messmateSocketCleanupTimer) {
    global.__messmateSocketCleanupTimer = setInterval(() => {
      cleanupStaleSockets(io);
    }, 60 * 1000);
    if (typeof global.__messmateSocketCleanupTimer.unref === 'function') {
      global.__messmateSocketCleanupTimer.unref();
    }
  }

  return global.__messmateSocketServer;
}

function getSocketServer() {
  return global.__messmateSocketServer || null;
}

module.exports = {
  initializeSocketServer,
  getSocketServer,
  emitToRooms,
  SOCKET_EVENTS,
  ROLE_ROOM_BY_NAME,
  isAuthorizedRoomJoin,
};
