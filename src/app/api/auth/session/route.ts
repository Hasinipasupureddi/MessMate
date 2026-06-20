import { NextResponse } from 'next/server';
import { findUserByEmail } from '@/lib/api/authMySQL';
import { getSessionFromRequest, jsonWithSession } from '@/lib/auth/session';

/**
 * Phase 1 proof: read-only identity from httpOnly session cookie.
 * Optional `?compareStudentId=` logs whether it matches session `sub` (debug only).
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({
      authenticated: false,
      trust: 'anonymous',
      user: null,
    });
  }

  const url = new URL(request.url);
  const compareStudentId = url.searchParams.get('compareStudentId')?.trim();

  let dbUser = null;
  try {
    dbUser = await findUserByEmail(session.email);
  } catch (error) {
    console.warn('[messmate][auth/session] Falling back to token claims after profile lookup failed.', error);
  }

  if (dbUser && dbUser.id === session.sub) {
    const claimsChanged =
      dbUser.rollNo !== session.rollNo ||
      dbUser.name !== session.name ||
      dbUser.role !== session.role ||
      dbUser.hostelId !== session.hostelId ||
      dbUser.foodPreference !== session.foodPreference;

    if (claimsChanged) {
      return jsonWithSession(
        {
          authenticated: true,
          trust: 'session-backed-read',
          user: {
            id: dbUser.id,
            rollNo: dbUser.rollNo,
            email: dbUser.email,
            name: dbUser.name,
            role: dbUser.role,
            hostelId: dbUser.hostelId,
            foodPreference: dbUser.foodPreference,
          },
          debug:
            compareStudentId !== undefined && compareStudentId !== ''
              ? {
                  compareStudentId,
                  sessionUserId: dbUser.id,
                  match: dbUser.id === compareStudentId,
                }
              : undefined,
        },
        {
          id: dbUser.id,
          rollNo: dbUser.rollNo,
          email: dbUser.email,
          name: dbUser.name,
          role: dbUser.role,
          hostelId: dbUser.hostelId,
          foodPreference: dbUser.foodPreference,
        }
      );
    }
  }

  return NextResponse.json({
    authenticated: true,
    trust: 'session-backed-read',
    user: {
      id: session.sub,
      rollNo: session.rollNo,
      email: session.email,
      name: session.name,
      role: session.role,
      hostelId: session.hostelId,
      foodPreference: session.foodPreference,
    },
    debug:
      compareStudentId !== undefined && compareStudentId !== ''
        ? {
            compareStudentId,
            sessionUserId: session.sub,
            match: session.sub === compareStudentId,
          }
        : undefined,
  });
}
