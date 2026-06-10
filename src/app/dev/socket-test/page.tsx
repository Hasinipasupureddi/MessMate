'use client';

import { useEffect, useRef, useState } from 'react';
import {
  disconnectMessMateSocket,
  getMessMateSocket,
  SOCKET_EVENTS,
} from '@/lib/socket/client';
import { createRequestId } from '@/lib/socket/observability';

const MAX_LOG_ENTRIES = 100;
const TEST_EVENT_COOLDOWN_MS = 250;
const HEARTBEAT_INTERVAL_MS = 30_000;

type LogEntry = {
  id: string;
  event: string;
  detail: string;
  timestamp: string;
  requestId?: string;
};

type SocketHealthSnapshot = {
  activeClients: number;
  metrics?: {
    activeSockets: number;
    totalConnections: number;
    reconnectCount: number;
    authFailures: number;
    disconnectReasons: Record<string, number>;
    transportCounts: Record<string, number>;
    pingCount: number;
    averagePingLatencyMs: number;
    lastHeartbeatAt: string | null;
    recentEvents: Array<Record<string, unknown>>;
  } | null;
};

type SocketSnapshot = {
  socketId: string;
  userId: string;
  role: string;
  hostelId: string;
  rooms: string[];
  activeClients: number | null;
  transport: string;
};

function createLogId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function formatDetail(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getSocketHealthUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://127.0.0.1:4001';
  return `${baseUrl.replace(/\/$/, '')}/health/socket`;
}

export default function SocketTestPage() {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const [status, setStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'>('connecting');
  const [socketId, setSocketId] = useState('');
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('unknown');
  const [hostelId, setHostelId] = useState('');
  const [rooms, setRooms] = useState<string[]>([]);
  const [activeClients, setActiveClients] = useState<number | null>(null);
  const [transport, setTransport] = useState('unknown');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastEvent, setLastEvent] = useState('none');
  const [serverTimestamp, setServerTimestamp] = useState('');
  const [now, setNow] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [socketHealth, setSocketHealth] = useState<SocketHealthSnapshot | null>(null);
  const lastTestEventAt = useRef<Record<string, number>>({});
  const appendLogRef = useRef<(event: string, detail: unknown, requestId?: string) => void>(() => undefined);

  const refreshSocketHealth = async () => {
    try {
      const response = await fetch(getSocketHealthUrl(), { cache: 'no-store' });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json().catch(() => null)) as SocketHealthSnapshot | null;
      if (payload) {
        setSocketHealth(payload);
      }
    } catch {
      // dev-only diagnostics view; ignore transient health fetch failures
    }
  };

  const emitWithRequestId = (eventName: string, payload: Record<string, unknown>, logEvent: string) => {
    const socket = getMessMateSocket();
    const requestId = createRequestId();
    appendLogRef.current(logEvent, payload, requestId);
    socket.emit(eventName, {
      ...payload,
      requestId,
    });
  };

  const runThrottledTestAction = (actionKey: string, action: () => void) => {
    const now = Date.now();
    const lastRun = lastTestEventAt.current[actionKey] ?? 0;

    if (now - lastRun < TEST_EVENT_COOLDOWN_MS) {
      appendLogRef.current('throttled', { actionKey, cooldownMs: TEST_EVENT_COOLDOWN_MS });
      return;
    }

    lastTestEventAt.current[actionKey] = now;
    action();
  };

  useEffect(() => {
    const updateClock = () => {
      setNow(new Date().toLocaleTimeString());
    };

    updateClock();

    const timer = window.setInterval(() => {
      updateClock();
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setLogs([]);
    setLastEvent('none');

    disconnectMessMateSocket();

    const socket = getMessMateSocket({ connect: false });

    const appendLog = (event: string, detail: unknown, requestId?: string) => {
      const timestamp = new Date().toISOString();
      setLastEvent(event);
      setLogs((current) => [
        ...current.slice(-(MAX_LOG_ENTRIES - 1)),
        {
          id: createLogId(),
          event,
          detail: formatDetail(detail),
          timestamp,
          requestId,
        },
      ]);
    };
    appendLogRef.current = appendLog;

    const bindSocketListener = <T extends unknown[]>(eventName: string, handler: (...args: T) => void) => {
      socket.off(eventName, handler as (...args: unknown[]) => void);
      socket.on(eventName, handler as (...args: unknown[]) => void);
    };

    const emitHeartbeat = () => {
      if (!socket.connected) {
        return;
      }

      const requestId = createRequestId();
      const clientTimestamp = new Date().toISOString();
      appendLog('heartbeat:sent', { clientTimestamp }, requestId);
      socket.emit(SOCKET_EVENTS.devPing, { clientTimestamp, requestId });
    };

    const refreshHealthSnapshot = () => {
      void refreshSocketHealth();
    };

    const handleConnect = () => {
      setStatus('connected');
      setSocketId(socket.id || '');
      appendLog('connect', { socketId: socket.id });
      emitHeartbeat();
      emitWithRequestId(SOCKET_EVENTS.devInspect, { requestedAt: new Date().toISOString() }, 'dev:inspect:sent');
      refreshHealthSnapshot();
    };

    const handleConnectError = (error: Error) => {
      setStatus('error');
      appendLog('connect_error', error.message);
    };

    const handleDisconnect = (reason: string) => {
      setStatus('disconnected');
      appendLog('disconnect', reason);
    };

    const handleReconnectAttempt = (attempt: number) => {
      setReconnectAttempts(attempt);
      setStatus('reconnecting');
      appendLog('reconnect_attempt', attempt);
    };

    const handleReconnect = (attempt: number) => {
      setStatus('connected');
      appendLog('reconnect', { attempt, socketId: socket.id });
    };

    const handleReconnectError = (error: Error) => {
      setStatus('error');
      appendLog('reconnect_error', error.message);
    };

    const handleReady = (payload: { userId: string; role: string; hostelId: string; requestId?: string }) => {
      setUserId(payload.userId);
      setRole(payload.role);
      setHostelId(payload.hostelId);
      appendLog('socket:ready', payload);
      emitWithRequestId(SOCKET_EVENTS.devInspect, { requestedAt: new Date().toISOString() }, 'dev:inspect:sent');
    };

    const handleInspect = (payload: SocketSnapshot & { requestId?: string }) => {
      setSocketId(payload.socketId || socket.id || '');
      setUserId(payload.userId || '');
      setRole(payload.role || 'unknown');
      setHostelId(payload.hostelId || '');
      setRooms(Array.isArray(payload.rooms) ? payload.rooms : []);
      setActiveClients(typeof payload.activeClients === 'number' ? payload.activeClients : null);
      setTransport(payload.transport || 'unknown');
      appendLog('dev:inspect:result', payload);
      refreshHealthSnapshot();
    };

    const handlePong = (payload: { socketId: string; receivedAt: string; clientTimestamp?: string; requestId?: string }) => {
      setServerTimestamp(payload.receivedAt);
      appendLog('dev:pong', payload);
      refreshHealthSnapshot();
    };

    const handleComplaint = (payload: unknown) => appendLog(SOCKET_EVENTS.complaintCreated, payload);
    const handleVote = (payload: unknown) => appendLog(SOCKET_EVENTS.mealVotesSubmitted, payload);
    const handleNotification = (payload: unknown) => appendLog(SOCKET_EVENTS.notificationsUpdated, payload);

    bindSocketListener('connect', handleConnect);
    bindSocketListener('connect_error', handleConnectError);
    bindSocketListener('disconnect', handleDisconnect);
    bindSocketListener('reconnect_attempt', handleReconnectAttempt);
    bindSocketListener('reconnect', handleReconnect);
    bindSocketListener('reconnect_error', handleReconnectError);
    bindSocketListener('socket:ready', handleReady);
    bindSocketListener(SOCKET_EVENTS.devInspectResult, handleInspect);
    bindSocketListener(SOCKET_EVENTS.devPong, handlePong);
    bindSocketListener(SOCKET_EVENTS.complaintCreated, handleComplaint);
    bindSocketListener(SOCKET_EVENTS.mealVotesSubmitted, handleVote);
    bindSocketListener(SOCKET_EVENTS.notificationsUpdated, handleNotification);

    void refreshSocketHealth();

    const heartbeatTimer = window.setInterval(() => {
      emitHeartbeat();
      refreshHealthSnapshot();
    }, HEARTBEAT_INTERVAL_MS);

    setStatus(socket.connected ? 'connected' : 'disconnected');
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      window.clearInterval(heartbeatTimer);
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnect_attempt', handleReconnectAttempt);
      socket.off('reconnect', handleReconnect);
      socket.off('reconnect_error', handleReconnectError);
      socket.off('socket:ready', handleReady);
      socket.off(SOCKET_EVENTS.devInspectResult, handleInspect);
      socket.off(SOCKET_EVENTS.devPong, handlePong);
      socket.off(SOCKET_EVENTS.complaintCreated, handleComplaint);
      socket.off(SOCKET_EVENTS.mealVotesSubmitted, handleVote);
      socket.off(SOCKET_EVENTS.notificationsUpdated, handleNotification);
      disconnectMessMateSocket();
    };
  }, []);

  const emitInspect = () => {
    runThrottledTestAction('inspect', () => {
      emitWithRequestId(SOCKET_EVENTS.devInspect, { requestedAt: new Date().toISOString() }, 'dev:inspect:sent');
    });
  };

  const emitPing = () => {
    runThrottledTestAction('ping', () => {
      emitWithRequestId(SOCKET_EVENTS.devPing, { clientTimestamp: new Date().toISOString() }, 'dev:ping:sent');
    });
  };

  const emitNotification = () => {
    runThrottledTestAction('notification', () => {
      getMessMateSocket().emit(SOCKET_EVENTS.devTestNotification, {
        userId: userId || 'dev-user',
        message: 'Dev notification from socket test page',
        severity: 'info',
        requestId: createRequestId(),
      });
    });
  };

  const emitComplaint = () => {
    runThrottledTestAction('complaint', () => {
      getMessMateSocket().emit(SOCKET_EVENTS.devTestComplaint, {
        studentId: userId || 'dev-student',
        complaintText: 'Dev complaint generated from diagnostics page',
        category: 'mess',
        requestId: createRequestId(),
      });
    });
  };

  const emitVote = () => {
    runThrottledTestAction('vote', () => {
      getMessMateSocket().emit(SOCKET_EVENTS.devTestVote, {
        studentId: userId || 'dev-student',
        voteDate: new Date().toISOString().slice(0, 10),
        requestId: createRequestId(),
        votes: [
          {
            mealType: 'lunch',
            dishName: 'Diagnostics lunch vote',
          },
        ],
      });
    });
  };

  const reconnectSocket = () => {
    const socket = getMessMateSocket();
    socket.connect();
  };

  const disconnectSocket = () => {
    disconnectMessMateSocket();
    setStatus('disconnected');
    setLastEvent('manual disconnect');
    setLogs((current) => [
      ...current.slice(-(MAX_LOG_ENTRIES - 1)),
      {
        id: createLogId(),
        event: 'manual disconnect',
        detail: 'Socket disconnected from dev page',
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  return (
    <main className="min-h-screen bg-[#07111d] text-white px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/80">Development only</p>
              <h1 className="mt-2 text-3xl font-semibold">Socket Diagnostics</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/70">
                Temporary connection probe for realtime stabilization. Use this to verify socket state,
                room membership, reconnect behavior, and event delivery before enabling more UI.
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200">
              <div>Status: {status}</div>
              <div className="text-xs text-cyan-100/70" suppressHydrationWarning>
                Live timestamp: {now || 'waiting for clock'}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Socket ID" value={socketId || 'not connected'} />
          <StatCard label="Authenticated role" value={role} />
          <StatCard label="Hostel" value={hostelId || 'unknown'} />
          <StatCard label="Reconnect attempts" value={String(reconnectAttempts)} />
          <StatCard label="Live user count" value={activeClients === null ? 'unknown' : String(activeClients)} />
          <StatCard label="Transport" value={transport} />
          <StatCard label="Last event" value={lastEvent} />
          <StatCard label="Server ping" value={serverTimestamp || 'no ping yet'} />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Socket Health</h2>
          <p className="mt-1 text-sm text-white/60">Server-side heartbeat and observability snapshot.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Active sockets" value={String(socketHealth?.metrics?.activeSockets ?? socketHealth?.activeClients ?? 'unknown')} />
            <StatCard label="Reconnect count" value={String(socketHealth?.metrics?.reconnectCount ?? 'unknown')} />
            <StatCard label="Avg ping latency" value={socketHealth?.metrics?.averagePingLatencyMs === undefined || socketHealth?.metrics?.averagePingLatencyMs === null ? 'unknown' : `${socketHealth.metrics.averagePingLatencyMs}ms`} />
            <StatCard label="Auth failures" value={String(socketHealth?.metrics?.authFailures ?? 'unknown')} />
          </div>
          <div className="mt-4 text-xs text-white/55">
            Disconnect reasons: {socketHealth?.metrics?.disconnectReasons ? JSON.stringify(socketHealth.metrics.disconnectReasons) : 'unknown'}
          </div>
          <div className="mt-2 text-xs text-white/55">
            Transport counts: {socketHealth?.metrics?.transportCounts ? JSON.stringify(socketHealth.metrics.transportCounts) : 'unknown'}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold">Controls</h2>
            <p className="mt-1 text-sm text-white/60">
              These actions exercise the exact socket client helper used by the app.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ActionButton label="Refresh room snapshot" onClick={emitInspect} />
              <ActionButton label="Realtime ping" onClick={emitPing} />
              <ActionButton label="Emit test notification" onClick={emitNotification} />
              <ActionButton label="Emit complaint event" onClick={emitComplaint} />
              <ActionButton label="Emit vote event" onClick={emitVote} />
              <ActionButton label="Reconnect socket" onClick={reconnectSocket} />
              <ActionButton label="Disconnect socket" onClick={disconnectSocket} tone="danger" />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold">Joined Rooms</h2>
            <p className="mt-1 text-sm text-white/60">Room snapshot reported by the server.</p>
            <div className="mt-4 flex min-h-40 flex-wrap gap-2">
              {rooms.length > 0 ? (
                rooms.map((room) => (
                  <span key={room} className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
                    {room}
                  </span>
                ))
              ) : (
                <p className="text-sm text-white/50">No room snapshot yet. Click refresh room snapshot.</p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Realtime Event Log</h2>
              <p className="text-sm text-white/60">Most recent socket traffic and diagnostics responses.</p>
            </div>
            <div className="text-xs text-white/50">Cleanup runs on unmount</div>
          </div>
          <div className="mt-4 max-h-[24rem] space-y-3 overflow-auto rounded-2xl border border-white/10 bg-slate-950/70 p-4 font-mono text-xs">
            {logs.length > 0 ? (
              logs.slice().reverse().map((entry) => (
                <div key={entry.id} className="rounded-xl border border-white/5 bg-white/5 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-cyan-200">
                    <span>{entry.event}</span>
                    <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  </div>
                  {entry.requestId ? (
                    <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-white/45">requestId: {entry.requestId}</div>
                  ) : null}
                  <pre className="mt-2 whitespace-pre-wrap break-words text-white/75">{entry.detail}</pre>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/50">No events yet. Connect the socket to begin.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur-md">
      <div className="text-xs uppercase tracking-[0.3em] text-white/45">{label}</div>
      <div className="mt-2 break-all text-sm font-medium text-white">{value}</div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  tone = 'primary',
}: {
  label: string;
  onClick: () => void;
  tone?: 'primary' | 'danger';
}) {
  const className =
    tone === 'danger'
      ? 'border-rose-400/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20'
      : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${className}`}
    >
      {label}
    </button>
  );
}
