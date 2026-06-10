/** @jest-environment node */

import { emitRealtimeEvent } from '@/lib/socket/bridge';

describe('Bridge client contracts', () => {
  const originalBridgeSecret = process.env.SOCKET_BRIDGE_SECRET;
  const originalBridgeUrl = process.env.SOCKET_BRIDGE_URL;

  beforeEach(() => {
    process.env.SOCKET_BRIDGE_SECRET = 'bridge-secret-test-value';
    process.env.SOCKET_BRIDGE_URL = 'http://127.0.0.1:4001/internal/socket/emit';
    jest.restoreAllMocks();
  });

  afterEach(() => {
    if (originalBridgeSecret === undefined) {
      delete process.env.SOCKET_BRIDGE_SECRET;
    } else {
      process.env.SOCKET_BRIDGE_SECRET = originalBridgeSecret;
    }

    if (originalBridgeUrl === undefined) {
      delete process.env.SOCKET_BRIDGE_URL;
    } else {
      process.env.SOCKET_BRIDGE_URL = originalBridgeUrl;
    }
  });

  it('propagates request IDs and sender metadata through bridge emits', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    global.fetch = fetchMock as never;

    await emitRealtimeEvent('meal-votes:submitted', { voteDate: '2026-05-26' }, {
      rooms: ['role:student'],
      requestId: 'req-bridge-1',
      sender: { userId: 'demo-student-1', role: 'student', hostelId: 'A' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:4001/internal/socket/emit',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-messmate-socket-secret': 'bridge-secret-test-value',
        }),
      })
    );

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual(expect.objectContaining({
      event: 'meal-votes:submitted',
      requestId: 'req-bridge-1',
      sender: { userId: 'demo-student-1', role: 'student', hostelId: 'A' },
    }));
  });

  it('aborts bridge requests that exceed the timeout budget', async () => {
    jest.useFakeTimers();
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const fetchMock = jest.fn((_, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }));
    global.fetch = fetchMock as never;

    const emitPromise = emitRealtimeEvent('dashboard:refresh', { reason: 'timeout-test' }, { timeoutMs: 1 });
    await jest.advanceTimersByTimeAsync(2);
    await emitPromise;

    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalled();

    jest.useRealTimers();
    consoleWarnSpy.mockRestore();
  });
});