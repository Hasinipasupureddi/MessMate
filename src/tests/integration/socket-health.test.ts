/** @jest-environment node */

export {};

const healthRoutes = require('../../../server/routes/health.js');

function getSocketHealthHandler() {
  const layer = healthRoutes.stack.find((entry: any) => entry.route?.path === '/socket');
  if (!layer) {
    throw new Error('Socket health route not found.');
  }

  return layer.route.stack[0].handle;
}

function createMockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('Socket health contracts', () => {
  beforeEach(() => {
    (global as any).__messmateSocketServer = { io: { engine: { clientsCount: 7 } } };
    (global as any).__messmateSocketMetrics = {
      activeSockets: 7,
      totalConnections: 12,
      reconnectCount: 3,
      authFailures: 2,
      rejectedConnections: 2,
      disconnectReasons: { pingTimeout: 1 },
      transportCounts: { websocket: 5 },
      pingCount: 4,
      averagePingLatencyMs: 41.5,
      lastHeartbeatAt: '2026-05-26T05:23:21.884Z',
      rateLimitedEmits: 1,
      recentEvents: [],
    };
  });

  afterEach(() => {
    delete (global as any).__messmateSocketServer;
    delete (global as any).__messmateSocketMetrics;
  });

  it('exposes the socket health metrics shape', async () => {
    const handler = getSocketHealthHandler();
    const res = createMockResponse();

    await handler({}, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        socketReady: true,
        events: expect.arrayContaining(['complaints:created', 'meal-votes:submitted']),
        summary: expect.objectContaining({
          activeSockets: 7,
          roomsCount: 0,
          reconnectCount: 3,
          rejectedConnections: 2,
          rateLimitedEmits: 1,
        }),
        metrics: expect.objectContaining({
          activeSockets: 7,
          reconnectCount: 3,
          averagePingLatencyMs: 41.5,
          authFailures: 2,
          rejectedConnections: 2,
          rateLimitedEmits: 1,
        }),
      })
    );
  });
});