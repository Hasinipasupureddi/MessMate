import { NextResponse } from 'next/server';
import { getMysqlPool } from '@/lib/db/mysql';
import { ensureMysqlSchema } from '@/lib/db/init';
import { getSessionFromRequest, jsonWithSession } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { userId, foodPreference } = await request.json();

    if (!userId || !foodPreference) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    if (userId !== session.sub) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    if (foodPreference !== 'veg' && foodPreference !== 'non_veg') {
      return NextResponse.json({ message: 'Invalid food preference' }, { status: 400 });
    }

    await ensureMysqlSchema();
    const pool = getMysqlPool();

    await pool.execute(
      'UPDATE users SET food_preference = ? WHERE id = ?',
      [foodPreference, userId]
    );

    // Refresh the session with the new preference
    return jsonWithSession(
      { success: true },
      {
        id: session.sub,
        rollNo: session.rollNo,
        email: session.email,
        name: session.name,
        role: session.role,
        hostelId: session.hostelId,
        foodPreference: foodPreference as 'veg' | 'non_veg',
        emailVerified: session.emailVerified,
      }
    );
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}
