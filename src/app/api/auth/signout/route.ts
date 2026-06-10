import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';

export async function POST() {
  const res = NextResponse.json({ signedOut: true });
  // clear cookie by setting a past expiration / maxAge 0
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  // note: no readable socket mirror cookie in production-safe flow
  return res;
}
