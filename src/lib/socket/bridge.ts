import { SOCKET_EVENTS, type AppRole, type SocketEventName } from './events';
import { createRequestId } from './observability';

type BroadcastOptions = {
  rooms?: string[];
  roles?: AppRole[];
  sender?: {
    userId: string;
    role: AppRole;
    hostelId: string;
  };
  requestId?: string;
  timeoutMs?: number;
};

function getBridgeUrl() {
  if (process.env.SOCKET_BRIDGE_URL) {
    return process.env.SOCKET_BRIDGE_URL;
  }

  return '';
}

function getBridgeSecret() {
  return process.env.SOCKET_BRIDGE_SECRET || process.env.MESSMATE_SOCKET_BRIDGE_SECRET || '';
}

export async function emitRealtimeEvent(
  event: SocketEventName,
  payload: unknown,
  options: BroadcastOptions = {}
): Promise<void> {
  if (typeof fetch === 'undefined') {
    return;
  }

  const bridgeSecret = getBridgeSecret();
  const bridgeUrl = getBridgeUrl();
  const requestId = options.requestId || createRequestId();
  const timeoutMs = options.timeoutMs ?? 5000;

  if (!bridgeSecret || !bridgeUrl) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[messmate][socket] bridge not configured, skipping emit for', { event, requestId });
    }
    return;
  }

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    await fetch(bridgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-messmate-socket-secret': bridgeSecret,
      },
      signal: controller.signal,
      body: JSON.stringify({
        event,
        payload,
        rooms: options.rooms,
        roles: options.roles,
        requestId,
        timestamp: new Date().toISOString(),
        sender: options.sender,
      }),
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      const isTimeout = error instanceof DOMException && error.name === 'AbortError';
      console.warn('[messmate][socket] bridge emit failed', { event, requestId, isTimeout, error });
    }
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export { SOCKET_EVENTS };
