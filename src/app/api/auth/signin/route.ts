import { NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/api/authMySQL';
import { jsonWithSession, type SessionUserInput } from '@/lib/auth/session';

const DEMO_USERS: Record<string, { password: string; profile: SessionUserInput }> = {
  'arjun.mehta@messmate.in': {
    password: 'Student@2026',
    profile: { id: 'demo-student-1', rollNo: '2023CS001', email: 'arjun.mehta@messmate.in', name: 'Arjun Mehta', role: 'student', hostelId: 'A', foodPreference: 'non_veg' },
  },
  'raju.cook@messmate.in': {
    password: 'Cook@2026',
    profile: { id: 'demo-staff-1', email: 'raju.cook@messmate.in', name: 'Raju Cook', role: 'staff', hostelId: 'A', foodPreference: 'non_veg' },
  },
  'dr.sharma@messmate.in': {
    password: 'Warden@2026',
    profile: { id: 'demo-warden-1', email: 'dr.sharma@messmate.in', name: 'Dr Sharma', role: 'warden', hostelId: 'A', foodPreference: 'non_veg' },
  },
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier = String(body?.email ?? '').trim();
    const password = String(body?.password ?? '');
    const rememberMe = Boolean(body?.rememberMe);

    if (!identifier || !password) {
      return NextResponse.json({ message: 'Roll Number/Email and password are required.' }, { status: 400 });
    }

    // Check demo users first
    const demo = DEMO_USERS[identifier.toLowerCase()];
    if (demo && demo.password === password) {
      return jsonWithSession(
        { user: demo.profile, session: { local: true, rememberMe } },
        demo.profile,
        undefined,
        rememberMe ? { expiresIn: '30d', maxAgeSeconds: 60 * 60 * 24 * 30 } : { expiresIn: '12h' }
      );
    }

    // Authenticate against MySQL
    const user = await authenticateUser(identifier, password);

    const sessionUser: SessionUserInput = {
      id: user.id,
      rollNo: user.rollNo,
      email: user.email,
      name: user.name,
      role: user.role,
      hostelId: user.hostelId,
      foodPreference: user.foodPreference,
    };

    return jsonWithSession(
      { user, session: { local: true, rememberMe } },
      sessionUser,
      undefined,
      rememberMe ? { expiresIn: '30d', maxAgeSeconds: 60 * 60 * 24 * 30 } : { expiresIn: '12h' }
    );
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error)?.message || 'Failed to sign in.' },
      { status: 401 }
    );
  }
}
