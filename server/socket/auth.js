const jwt = require('jsonwebtoken');
const logger = require('../lib/logger');

const VALID_ROLES = new Set(['student', 'staff', 'warden']);

function getJwtSecret() {
  const secret = process.env.MESSMATE_JWT_SECRET || process.env.JWT_SECRET || '';
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('MESSMATE_JWT_SECRET is required in production');
  }
  return secret || 'change_this_secret_in_production';
}

function readCookieValue(cookieHeader, name) {
  if (!cookieHeader) return null;
  const segments = cookieHeader.split(';');
  for (const segment of segments) {
    const index = segment.indexOf('=');
    if (index === -1) continue;
    const key = segment.slice(0, index).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(segment.slice(index + 1).trim());
    } catch {
      return segment.slice(index + 1).trim();
    }
  }
  return null;
}

function getSocketToken(socket) {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim()) {
    return authToken.trim();
  }

  return readCookieValue(socket.handshake.headers.cookie, 'messmate_session');
}

function verifySocketSession(socket) {
  const token = getSocketToken(socket);
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
    const role = String(payload.role || '').trim();
    if (!payload.sub || !payload.email || !VALID_ROLES.has(role)) {
      logger.warn({ payload }, 'socket token missing required claims');
      return null;
    }

    return {
      sub: String(payload.sub),
      email: String(payload.email),
      name: String(payload.name || ''),
      role,
      hostelId: String(payload.hostelId || 'A'),
      emailVerified: Boolean(payload.emailVerified),
    };
  } catch {
    logger.warn('socket token verification failed');
    return null;
  }
}

module.exports = {
  verifySocketSession,
};
