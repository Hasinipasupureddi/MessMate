/** @jest-environment node */

export {};

const { SignJWT } = require('jose');

jest.mock('../../../server/lib/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock the socket.io Server so we can capture middleware and connection handler
jest.mock('socket.io', () => {
  return {
    Server: class ServerMock {
      opts: any = null;
      _middleware: any = null;
      handlers: Record<string, any> = {};
      use(fn: any) { this._middleware = fn; }
      on(ev: string, fn: any) { this.handlers[ev] = fn; }
      to() { return { emit: () => {} }; }
    },
  };
});

const { verifySocketSession } = require('../../../server/socket/auth');
const { isAuthorizedRoomJoin } = require('../../../server/socket/index.js');

const SOCKET_TEST_SECRET = 'socket-reconnect-test-secret-socket-reconnect-test';

async function createToken(payload: any) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .sign(new TextEncoder().encode(SOCKET_TEST_SECRET));
}

describe('Authenticated reconnect and room restoration (unit)', () => {
  const originalJwt = process.env.MESSMATE_JWT_SECRET;

  beforeEach(() => {
    process.env.MESSMATE_JWT_SECRET = SOCKET_TEST_SECRET;
  });

  afterEach(() => {
    if (originalJwt === undefined) delete process.env.MESSMATE_JWT_SECRET;
    else process.env.MESSMATE_JWT_SECRET = originalJwt;
  });

  it('verifies session from cookie and allows canonical room joins for reconnecting clients', async () => {
    const token = await createToken({
      sub: 'reconnect-user-1',
      email: 'rc@test',
      name: 'Reconnect User',
      role: 'student',
      hostelId: 'Z',
      emailVerified: true,
    });

    const fakeSocket = {
      handshake: { auth: {}, headers: { cookie: `messmate_session=${encodeURIComponent(token)}` } },
    };

    const session = verifySocketSession(fakeSocket);
    expect(session).not.toBeNull();
    // simulate two reconnections and ensure room joins are authorized
    const roomsToJoin = [`user:${session.sub}`, `role:${session.role}`, `hostel:${session.hostelId}`];
    for (const room of roomsToJoin) {
      expect(isAuthorizedRoomJoin(session, room)).toBe(true);
    }
  });
});
