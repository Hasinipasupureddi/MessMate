/** @jest-environment node */

import { GET as getSessionRoute } from '@/app/api/auth/session/route';
import { POST as postSigninRoute } from '@/app/api/auth/signin/route';
import { createSessionToken } from '@/lib/auth/session';

jest.mock('@/lib/api/authMySQL', () => ({
  authenticateUser: jest.fn(),
  findUserByEmail: jest.fn(),
}));

import { authenticateUser, findUserByEmail } from '@/lib/api/authMySQL';

const mockedAuthenticateUser = jest.mocked(authenticateUser);
const mockedFindUserByEmail = jest.mocked(findUserByEmail);

describe('Auth contracts', () => {
  const originalSecret = process.env.MESSMATE_JWT_SECRET;

  beforeEach(() => {
    process.env.MESSMATE_JWT_SECRET = 'auth-contract-test-secret-auth-contract-test-secret';
    jest.clearAllMocks();
    mockedFindUserByEmail.mockResolvedValue(null);
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.MESSMATE_JWT_SECRET;
    } else {
      process.env.MESSMATE_JWT_SECRET = originalSecret;
    }
  });

  it('returns an anonymous session with 200', async () => {
    const response = await getSessionRoute(new Request('http://localhost/api/auth/session'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      authenticated: false,
      trust: 'anonymous',
      user: null,
    });
  });

  it('returns a session-backed user with 200 when the cookie is valid', async () => {
    const token = await createSessionToken({
      id: 'demo-warden-1',
      email: 'dr.sharma@messmate.in',
      name: 'Dr Sharma',
      role: 'warden',
      hostelId: 'A',
      foodPreference: 'non_veg',
    });

    const request = new Request('http://localhost/api/auth/session', {
      headers: {
        cookie: `messmate_session=${encodeURIComponent(token)}`,
      },
    });

    const response = await getSessionRoute(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      authenticated: true,
      trust: 'session-backed-read',
      user: {
        id: 'demo-warden-1',
        email: 'dr.sharma@messmate.in',
        name: 'Dr Sharma',
        role: 'warden',
        hostelId: 'A',
        foodPreference: 'non_veg',
      },
    });
  });

  it('signs in demo users with canonical roles', async () => {
    const response = await postSigninRoute(
      new Request('http://localhost/api/auth/signin', {
        method: 'POST',
        body: JSON.stringify({
          email: 'arjun.mehta@messmate.in',
          password: 'Student@2026',
          rememberMe: true,
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('messmate_session=');
    await expect(response.json()).resolves.toMatchObject({
      user: {
        email: 'arjun.mehta@messmate.in',
        role: 'student',
      },
      session: {
        local: true,
        rememberMe: true,
      },
    });
  });

  it('rejects invalid login credentials with 401', async () => {
    mockedAuthenticateUser.mockRejectedValueOnce(new Error('Invalid credentials'));

    const response = await postSigninRoute(
      new Request('http://localhost/api/auth/signin', {
        method: 'POST',
        body: JSON.stringify({
          email: 'night.guard@messmate.in',
          password: 'wrong-password',
        }),
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      message: 'Invalid credentials',
    });
    expect(mockedAuthenticateUser).toHaveBeenCalledWith('night.guard@messmate.in', 'wrong-password');
  });
});