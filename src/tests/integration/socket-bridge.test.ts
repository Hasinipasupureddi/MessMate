/** @jest-environment node */

export {};

const emitToRooms = jest.fn();

jest.mock('../../../server/lib/logger', () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../server/socket', () => ({
  emitToRooms,
  SOCKET_EVENTS: {
    complaintsCreated: 'complaints:created',
    mealVotesSubmitted: 'meal:votes:submitted',
    mealOptinsUpdated: 'meal:optins:updated',
    dashboardRefresh: 'dashboard:refresh',
  },
}));

const internalRoutes = require('../../../server/routes/internal.js');

function getSocketEmitHandler() {
  const layer = internalRoutes.stack.find((entry: any) => entry.route?.path === '/socket/emit');
  if (!layer) {
    throw new Error('Socket emit route not found.');
  }

  return layer.route.stack[0].handle;
}

function createMockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('Internal bridge contracts', () => {
  const originalBridgeSecret = process.env.SOCKET_BRIDGE_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SOCKET_BRIDGE_SECRET = 'bridge-secret-test-value';
    delete process.env.MESSMATE_SOCKET_BRIDGE_SECRET;
    (global as any).__messmateSocketServer = { io: { id: 'mock-io' } };
  });

  afterEach(() => {
    if (originalBridgeSecret === undefined) {
      delete process.env.SOCKET_BRIDGE_SECRET;
    } else {
      process.env.SOCKET_BRIDGE_SECRET = originalBridgeSecret;
    }

    delete (global as any).__messmateSocketServer;
  });

  it('accepts a valid bridge secret and forwards room-targeted emits', async () => {
    const handler = getSocketEmitHandler();
    const req = {
      headers: {
        'x-messmate-socket-secret': 'bridge-secret-test-value',
      },
      body: {
        event: 'meal:votes:submitted',
        payload: { voteDate: '2026-05-26' },
        rooms: ['role:student'],
        sender: { userId: 'demo-student-1', role: 'student', hostelId: 'A' },
        requestId: 'req-123',
      },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(emitToRooms).toHaveBeenCalledWith(
      { id: 'mock-io' },
      'meal:votes:submitted',
      { voteDate: '2026-05-26' },
      expect.objectContaining({
        rooms: ['role:student'],
        requestId: 'req-123',
        sender: { userId: 'demo-student-1', role: 'student', hostelId: 'A' },
        timestamp: expect.any(String),
      })
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, event: 'meal:votes:submitted', requestId: 'req-123' });
  });

  it('rejects invalid bridge secrets with 401', async () => {
    const handler = getSocketEmitHandler();
    const req = {
      headers: {
        'x-messmate-socket-secret': 'wrong-secret',
      },
      body: {
        event: 'meal:votes:submitted',
        payload: {},
      },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(emitToRooms).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Unauthorized bridge request.',
      requestId: expect.any(String),
    });
  });

  it('rejects malformed bridge payloads with 400', async () => {
    const handler = getSocketEmitHandler();
    const req = {
      headers: {
        'x-messmate-socket-secret': 'bridge-secret-test-value',
      },
      body: {
        payload: { hello: 'world' },
      },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(emitToRooms).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'event is required.',
      requestId: expect.any(String),
    });
  });
});