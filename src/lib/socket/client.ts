import { io, type Socket } from 'socket.io-client';
import { ROLE_ROOMS, type AppRole, SOCKET_EVENTS, type SocketEventName } from './events';

type MessMateSocket = Socket;

declare global {
  var __messmate_socket_client__: MessMateSocket | undefined;
  var __messmate_socket_subscriptions__: number | undefined;
  var __messmate_socket_listeners_attached__: boolean | undefined;
}

function getSocketUrl() {
  return process.env.NEXT_PUBLIC_SOCKET_URL || 'http://127.0.0.1:4001';
}

// In production-safe flow we rely on the HttpOnly `messmate_session` cookie
// being sent by the browser on the socket handshake (withCredentials: true).
// The previous dev-only readable mirror cookie (`messmate_session_socket`) has
// been removed to avoid exposing tokens in client JS.

function attachLogging(socket: MessMateSocket) {
  if (globalThis.__messmate_socket_listeners_attached__) {
    return;
  }

  socket.on('connect_error', (error) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[messmate][socket] connect_error', error.message);
    }
  });

  socket.on('reconnect_attempt', (attempt) => {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[messmate][socket] reconnect_attempt', attempt);
    }
  });

  socket.on('reconnect_error', (error) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[messmate][socket] reconnect_error', error.message);
    }
  });

  socket.on('error', (error) => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[messmate][socket] error', error);
    }
  });

  globalThis.__messmate_socket_listeners_attached__ = true;
}

export function getMessMateSocket(options?: { connect?: boolean }): MessMateSocket {
  const shouldConnect = options?.connect ?? true;

  if (globalThis.__messmate_socket_client__) {
    return globalThis.__messmate_socket_client__;
  }

  const socketUrl = getSocketUrl();
  if (!socketUrl) {
    throw new Error('NEXT_PUBLIC_SOCKET_URL is not configured.');
  }

  const socket = io(socketUrl, {
    autoConnect: false,
    withCredentials: true,
    transports: ['polling', 'websocket'],
    // rely on server-side cookie verification; do not include readable tokens
    // in the auth payload for production safety
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  attachLogging(socket);
  globalThis.__messmate_socket_client__ = socket;
  globalThis.__messmate_socket_subscriptions__ = 0;

  if (shouldConnect) {
    socket.connect();
  }

  return socket;
}

export function subscribeSocketEvent<T>(eventName: SocketEventName, handler: (payload: T) => void) {
  const socket = getMessMateSocket();
  socket.off(eventName, handler as (...args: unknown[]) => void);
  socket.on(eventName, handler as (...args: unknown[]) => void);
  globalThis.__messmate_socket_subscriptions__ = (globalThis.__messmate_socket_subscriptions__ || 0) + 1;

  return () => {
    socket.off(eventName, handler as (...args: unknown[]) => void);
    const nextCount = Math.max(0, (globalThis.__messmate_socket_subscriptions__ || 1) - 1);
    globalThis.__messmate_socket_subscriptions__ = nextCount;
    if (nextCount === 0) {
      socket.disconnect();
      globalThis.__messmate_socket_client__ = undefined;
      globalThis.__messmate_socket_listeners_attached__ = false;
    }
  };
}

export function joinRoleRoom(role: AppRole) {
  const socket = getMessMateSocket();
  socket.emit('room:join', ROLE_ROOMS[role]);
}

export function leaveRoleRoom(role: AppRole) {
  const socket = getMessMateSocket();
  socket.emit('room:leave', ROLE_ROOMS[role]);
}

export function disconnectMessMateSocket() {
  const socket = globalThis.__messmate_socket_client__;
  if (!socket) {
    return;
  }

  socket.disconnect();
  globalThis.__messmate_socket_client__ = undefined;
  globalThis.__messmate_socket_subscriptions__ = 0;
  globalThis.__messmate_socket_listeners_attached__ = false;
}

export { SOCKET_EVENTS };
