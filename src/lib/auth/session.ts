import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { NextResponse } from 'next/server';

export const SESSION_COOKIE_NAME = 'messmate_session';

export type AppRole = 'student' | 'staff' | 'warden';

export type SessionClaims = {
  sub: string;
  rollNo?: string;
  email: string;
  name: string;
  role: AppRole;
  hostelId: string;
  foodPreference?: 'veg' | 'non_veg';
  emailVerified?: boolean;
};

let warnedInsecureSecret = false;

function secretKey(): Uint8Array {
  const raw = process.env.MESSMATE_JWT_SECRET;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MESSMATE_JWT_SECRET is required in production');
    }
    if (!warnedInsecureSecret) {
      warnedInsecureSecret = true;
      console.warn('[messmate] MESSMATE_JWT_SECRET unset — using a dev-only signing key.');
    }
    const dev = 'messmate-dev-jwt-secret-min-32-characters-long!';
    return new TextEncoder().encode(dev);
  }
  return new TextEncoder().encode(raw);
}

export type SessionUserInput = {
  id: string;
  rollNo?: string;
  email: string;
  name: string;
  role: AppRole;
  hostelId: string;
  foodPreference?: 'veg' | 'non_veg';
  emailVerified?: boolean;
};

export async function createSessionToken(
  user: SessionUserInput,
  options?: { expiresIn?: string }
): Promise<string> {
  const expiresIn = options?.expiresIn || '7d';

  return new SignJWT({
    rollNo: user.rollNo,
    email: user.email,
    name: user.name,
    role: user.role,
    hostelId: user.hostelId,
    foodPreference: user.foodPreference,
    emailVerified: user.emailVerified,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    const sub = String(payload.sub ?? '');
    const p = payload as JWTPayload & {
      rollNo?: string;
      email?: string;
      name?: string;
      role?: string;
      hostelId?: string;
      foodPreference?: string;
    };
    const rollNo = p.rollNo ? String(p.rollNo) : undefined;
    const email = String(p.email ?? '');
    const name = String(p.name ?? '');
    const role = p.role;
    const hostelId = String(p.hostelId ?? 'A');
    const foodPreference = (p.foodPreference === 'veg' ? 'veg' : 'non_veg') as 'veg' | 'non_veg';
    const roles: AppRole[] = ['student', 'staff', 'warden'];
    if (!sub || !email || !role || !roles.includes(role as AppRole)) {
      return null;
    }
    return { sub, rollNo, email, name, role: role as AppRole, hostelId, foodPreference };
  } catch {
    return null;
  }
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return part.slice(eq + 1).trim();
      }
    }
  }
  return null;
}

export async function getSessionFromRequest(request: Request): Promise<SessionClaims | null> {
  const raw = readCookie(request, SESSION_COOKIE_NAME);
  if (!raw) return null;
  return verifySessionToken(raw);
}

export function setSessionCookie(response: NextResponse, token: string, maxAgeSeconds = 60 * 60 * 24 * 7): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // SameSite=None requires Secure; use Lax in dev so localhost cookies are not rejected.
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  });
}

export async function jsonWithSession(
  body: unknown,
  user: SessionUserInput,
  init?: ResponseInit
  ,
  options?: { expiresIn?: string; maxAgeSeconds?: number }
): Promise<NextResponse> {
  const token = await createSessionToken(user, { expiresIn: options?.expiresIn });
  const res = NextResponse.json(body, init);
  setSessionCookie(res, token, options?.maxAgeSeconds);
  return res;
}
