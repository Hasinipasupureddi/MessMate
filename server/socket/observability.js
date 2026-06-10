const { randomUUID } = require('crypto');

const MAX_RECENT_EVENTS = 100;
const SOCKET_EVENT_WINDOW_MS = 60 * 1000;
const SOCKET_EVENT_LIMIT = 120;
const SOCKET_STALE_TIMEOUT_MS = 5 * 60 * 1000;
const SOCKET_LISTENER_WARNING_LIMIT = 3;

function createRequestId() {
  if (typeof randomUUID === 'function') {
    return randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function createDefaultMetrics() {
  return {
    activeSockets: 0,
    totalConnections: 0,
    reconnectCount: 0,
    authFailures: 0,
    rejectedConnections: 0,
    seenUserIds: {},
    disconnectReasons: {},
    transportCounts: {},
    pingCount: 0,
    totalPingLatencyMs: 0,
    averagePingLatencyMs: 0,
    lastHeartbeatAt: null,
    lastActivityAt: null,
    rateLimitedEmits: 0,
    recentEvents: [],
  };
}

function ensureSocketMetrics() {
  if (!global.__messmateSocketMetrics) {
    global.__messmateSocketMetrics = createDefaultMetrics();
  }

  return global.__messmateSocketMetrics;
}

function recordRecentEvent(entry) {
  const metrics = ensureSocketMetrics();
  metrics.recentEvents = [...metrics.recentEvents.slice(-(MAX_RECENT_EVENTS - 1)), entry];
  metrics.lastHeartbeatAt = entry.timestamp || metrics.lastHeartbeatAt;
}

function markSocketActivity(socket, eventName) {
  const now = Date.now();
  if (!socket.data.activityWindowStartedAt || now - socket.data.activityWindowStartedAt > SOCKET_EVENT_WINDOW_MS) {
    socket.data.activityWindowStartedAt = now;
    socket.data.activityEventCount = 0;
  }

  socket.data.activityEventCount = (socket.data.activityEventCount || 0) + 1;
  socket.data.lastActivityAt = now;

  const metrics = ensureSocketMetrics();
  metrics.lastActivityAt = new Date(now).toISOString();

  recordRecentEvent({
    event: 'socket_activity',
    socketId: socket?.id,
    requestId: socket?.data?.lastRequestId || null,
    socketEvent: eventName,
    timestamp: new Date(now).toISOString(),
  });

  return socket.data.activityEventCount <= SOCKET_EVENT_LIMIT;
}

function recordRateLimitedEmit(socket, eventName) {
  const metrics = ensureSocketMetrics();
  metrics.rateLimitedEmits += 1;
  recordRecentEvent({
    event: 'rate_limited_emit',
    socketId: socket?.id,
    socketEvent: eventName,
    userId: socket?.data?.session?.sub,
    timestamp: new Date().toISOString(),
  });
}

function cleanupStaleSockets(io, maxIdleMs = SOCKET_STALE_TIMEOUT_MS) {
  if (!io?.of || typeof io.of !== 'function') {
    return 0;
  }

  const namespace = io.of('/');
  let cleaned = 0;
  for (const socket of namespace.sockets.values()) {
    const lastActivityAt = socket?.data?.lastActivityAt || socket?.data?.activityWindowStartedAt || 0;
    if (!lastActivityAt) {
      continue;
    }

    if (Date.now() - lastActivityAt > maxIdleMs) {
      socket.disconnect(true);
      cleaned += 1;
      recordRecentEvent({
        event: 'stale_socket_cleanup',
        socketId: socket.id,
        userId: socket.data?.session?.sub,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return cleaned;
}

function detectListenerLeak(socket, eventName) {
  if (!socket || typeof socket.listenerCount !== 'function') {
    return 0;
  }

  const count = socket.listenerCount(eventName);
  if (count > SOCKET_LISTENER_WARNING_LIMIT) {
    recordRecentEvent({
      event: 'listener_leak_warning',
      socketId: socket.id,
      socketEvent: eventName,
      listenerCount: count,
      timestamp: new Date().toISOString(),
    });
  }

  return count;
}

function recordAuthFailure(reason = 'unauthorized') {
  const metrics = ensureSocketMetrics();
  metrics.authFailures += 1;
  metrics.rejectedConnections += 1;
  recordRecentEvent({ event: 'auth_failure', reason, timestamp: new Date().toISOString() });
}

function updateTransportCount(transport) {
  const metrics = ensureSocketMetrics();
  const key = transport || 'unknown';
  metrics.transportCounts[key] = (metrics.transportCounts[key] || 0) + 1;
}

function recordConnection(io, socket, session) {
  const metrics = ensureSocketMetrics();
  metrics.totalConnections += 1;
  metrics.activeSockets = io?.engine?.clientsCount || metrics.activeSockets;
  if (session?.sub && metrics.seenUserIds[session.sub]) {
    metrics.reconnectCount += 1;
  }
  if (session?.sub) {
    metrics.seenUserIds[session.sub] = (metrics.seenUserIds[session.sub] || 0) + 1;
  }
  updateTransportCount(socket?.conn?.transport?.name || 'unknown');
  recordRecentEvent({
    event: 'connect',
    socketId: socket?.id,
    userId: session?.sub,
    role: session?.role,
    hostelId: session?.hostelId,
    transport: socket?.conn?.transport?.name || 'unknown',
    timestamp: new Date().toISOString(),
  });
}

function recordDisconnect(io, socket, session, reason) {
  const metrics = ensureSocketMetrics();
  metrics.activeSockets = io?.engine?.clientsCount || metrics.activeSockets;
  const key = reason || 'unknown';
  metrics.disconnectReasons[key] = (metrics.disconnectReasons[key] || 0) + 1;
  recordRecentEvent({
    event: 'disconnect',
    socketId: socket?.id,
    userId: session?.sub,
    role: session?.role,
    hostelId: session?.hostelId,
    reason: key,
    timestamp: new Date().toISOString(),
  });
}

function recordPingLatency(latencyMs) {
  if (typeof latencyMs !== 'number' || Number.isNaN(latencyMs)) {
    return;
  }

  const metrics = ensureSocketMetrics();
  metrics.pingCount += 1;
  metrics.totalPingLatencyMs += latencyMs;
  metrics.averagePingLatencyMs = Number((metrics.totalPingLatencyMs / metrics.pingCount).toFixed(2));
  recordRecentEvent({ event: 'ping', latencyMs: Number(latencyMs.toFixed(2)), timestamp: new Date().toISOString() });
}

function getSocketMetricsSnapshot() {
  const metrics = ensureSocketMetrics();
  return {
    activeSockets: metrics.activeSockets,
    totalConnections: metrics.totalConnections,
    reconnectCount: metrics.reconnectCount,
    authFailures: metrics.authFailures,
    rejectedConnections: metrics.rejectedConnections,
    disconnectReasons: { ...metrics.disconnectReasons },
    transportCounts: { ...metrics.transportCounts },
    pingCount: metrics.pingCount,
    averagePingLatencyMs: metrics.averagePingLatencyMs,
    lastHeartbeatAt: metrics.lastHeartbeatAt,
    rateLimitedEmits: metrics.rateLimitedEmits,
    recentEvents: [...metrics.recentEvents],
  };
}

function decorateSocketPayload(eventName, payload, metadata = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }

  return {
    ...payload,
    requestId: metadata.requestId || createRequestId(),
    event: eventName,
    timestamp: metadata.timestamp || new Date().toISOString(),
    sender: metadata.sender,
    targetRooms: metadata.targetRooms,
  };
}

module.exports = {
  MAX_RECENT_EVENTS,
  createRequestId,
  ensureSocketMetrics,
  recordAuthFailure,
  recordConnection,
  recordDisconnect,
  recordPingLatency,
  markSocketActivity,
  recordRateLimitedEmit,
  cleanupStaleSockets,
  detectListenerLeak,
  getSocketMetricsSnapshot,
  decorateSocketPayload,
  SOCKET_EVENT_LIMIT,
  SOCKET_EVENT_WINDOW_MS,
  SOCKET_STALE_TIMEOUT_MS,
};