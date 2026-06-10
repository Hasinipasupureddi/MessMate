import { NextResponse } from 'next/server';
import type { AppRole, SessionClaims } from './session';
import { getSessionFromRequest } from './session';

export async function getSession(request: Request): Promise<SessionClaims | null> {
  return getSessionFromRequest(request);
}

export type AuthResult =
  | { ok: true; session: SessionClaims }
  | { ok: false; response: NextResponse };

export async function requireAuth(request: Request): Promise<AuthResult> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return { ok: false, response: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) };
  }

  return { ok: true, session };
}

export async function requireRole(request: Request, roles: AppRole[]): Promise<AuthResult> {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth;
  if (!roles.includes(auth.session.role)) {
    return { ok: false, response: NextResponse.json({ message: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true, session: auth.session };
}
