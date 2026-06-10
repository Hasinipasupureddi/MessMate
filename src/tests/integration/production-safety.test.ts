/** @jest-environment node */

import { NextResponse } from 'next/server';

import { validateStartupEnvironment } from '../../../server/config/env.js';
import { setSessionCookie } from '@/lib/auth/session';

const internalRoutes = require('../../../server/routes/internal.js');
const { middleware } = require('../../../src/middleware.ts');

function getInternalSocketEmitHandler() {
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

describe('Production safety contracts', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalJwtSecret = process.env.MESSMATE_JWT_SECRET;
  const originalJwtFallback = process.env.JWT_SECRET;
  const originalSocketBridgeSecret = process.env.SOCKET_BRIDGE_SECRET;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete (process.env as any).NODE_ENV;
    } else {
      (process.env as any).NODE_ENV = originalNodeEnv;
    }

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

    if (originalSocketBridgeSecret === undefined) {
      delete process.env.SOCKET_BRIDGE_SECRET;
    } else {
      process.env.SOCKET_BRIDGE_SECRET = originalSocketBridgeSecret;
    }
  });

  it('blocks the dev diagnostics page in production', async () => {
    (process.env as any).NODE_ENV = 'production';

    const response = await middleware({
      nextUrl: { pathname: '/dev/socket-test' },
      url: 'http://127.0.0.1:4028/dev/socket-test',
      cookies: { get: jest.fn() },
    } as never);

    expect(response.status).toBe(404);
  });

  it('fails startup in production when required secrets are missing', () => {
    (process.env as any).NODE_ENV = 'production';

    delete process.env.MESSMATE_JWT_SECRET;
    delete process.env.JWT_SECRET;
    delete process.env.SOCKET_BRIDGE_SECRET;
    delete process.env.MESSMATE_SOCKET_BRIDGE_SECRET;

    expect(() => validateStartupEnvironment()).toThrow('Missing required production environment variables: MESSMATE_JWT_SECRET, SOCKET_BRIDGE_SECRET');
  });

  it('sets production cookie flags to HttpOnly, Secure and SameSite=lax', () => {
    (process.env as any).NODE_ENV = 'production';

    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, 'session-token', 3600);

    const cookie = response.cookies.get('messmate_session');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.secure).toBe(true);
    expect(cookie?.sameSite).toBe('lax');
  });

  it('requires a bridge secret before accepting internal emits', async () => {
    (process.env as any).NODE_ENV = 'production';
    delete process.env.SOCKET_BRIDGE_SECRET;

    const handler = getInternalSocketEmitHandler();
    const res = createMockResponse();

    await handler(
      {
        headers: {},
        body: {
          event: 'meal-votes:submitted',
          payload: { voteDate: '2026-05-26' },
          requestId: 'req-prod-bridge-1',
        },
      },
      res
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Unauthorized bridge request.',
        requestId: 'req-prod-bridge-1',
      })
    );
  });
});