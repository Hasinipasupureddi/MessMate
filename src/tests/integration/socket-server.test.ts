/** @jest-environment node */

import { SignJWT } from 'jose';

const SOCKET_TEST_SECRET = 'socket-auth-test-secret-socket-auth-test-secret';

jest.mock('../../../server/lib/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { verifySocketSession } = require('../../../server/socket/auth');
const { ROLE_ROOM_BY_NAME, isAuthorizedRoomJoin } = require('../../../server/socket/index.js');

async function createToken(payload: Record<string, unknown>) {
  return new SignJWT(payload as never)
    .setProtectedHeader({ alg: 'HS256' })
    .sign(new TextEncoder().encode(SOCKET_TEST_SECRET));
}

describe('Socket auth contracts', () => {
  const originalJwtSecret = process.env.MESSMATE_JWT_SECRET;
  const originalJwtFallback = process.env.JWT_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MESSMATE_JWT_SECRET = SOCKET_TEST_SECRET;
    process.env.JWT_SECRET = SOCKET_TEST_SECRET;
  });

  afterEach(() => {
    if (originalJwtSecret === undefined) {
      delete process.env.MESSMATE_JWT_SECRET;
    } else {
      process.env.MESSMATE_JWT_SECRET = originalJwtSecret;
    }

    if (originalJwtFallback === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtFallback;
    }
  });

  it('verifies socket sessions from the auth token handshake field', async () => {
    const token = await createToken({
      sub: 'demo-staff-1',
      email: 'raju.cook@messmate.in',
      name: 'Raju Cook',
      role: 'staff',
      hostelId: 'A',
      emailVerified: true,
    });

    const session = verifySocketSession({
      handshake: {
        auth: { token },
        headers: {},
      },
    });

    expect(session).toEqual({
      sub: 'demo-staff-1',
      email: 'raju.cook@messmate.in',
      name: 'Raju Cook',
      role: 'staff',
      hostelId: 'A',
      emailVerified: true,
    });
  });

  it('falls back to the session cookie when auth token is absent', async () => {
    const token = await createToken({
      sub: 'demo-student-1',
      email: 'arjun.mehta@messmate.in',
      name: 'Arjun Mehta',
      role: 'student',
      hostelId: 'B',
      emailVerified: true,
    });

    const session = verifySocketSession({
      handshake: {
        auth: {},
        headers: {
          cookie: `messmate_session=${encodeURIComponent(token)}`,
        },
      },
    });

    expect(session).toEqual({
      sub: 'demo-student-1',
      email: 'arjun.mehta@messmate.in',
      name: 'Arjun Mehta',
      role: 'student',
      hostelId: 'B',
      emailVerified: true,
    });
  });

  it('rejects missing or malformed socket credentials', () => {
    expect(
      verifySocketSession({
        handshake: {
          auth: {},
          headers: {},
        },
      })
    ).toBeNull();

    expect(
      verifySocketSession({
        handshake: {
          auth: { token: 'not-a-valid-jwt' },
          headers: {},
        },
      })
    ).toBeNull();
  });

  it('keeps canonical room names stable for role-based emits', () => {
    expect(ROLE_ROOM_BY_NAME).toEqual({
      student: 'role:student',
      staff: 'role:staff',
      warden: 'role:warden',
    });
  });

  it('rejects unauthorized room access outside the caller scope', () => {
    const session = {
      sub: 'demo-student-1',
      email: 'arjun.mehta@messmate.in',
      name: 'Arjun Mehta',
      role: 'student',
      hostelId: 'A',
      emailVerified: true,
    };

    expect(isAuthorizedRoomJoin(session, 'user:demo-student-1')).toBe(true);
    expect(isAuthorizedRoomJoin(session, 'role:student')).toBe(true);
    expect(isAuthorizedRoomJoin(session, 'hostel:A')).toBe(true);
    expect(isAuthorizedRoomJoin(session, 'role:warden')).toBe(false);
    expect(isAuthorizedRoomJoin(session, 'user:someone-else')).toBe(false);
  });
});