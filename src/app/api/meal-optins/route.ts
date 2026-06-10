import { NextResponse } from 'next/server';
import { getIstDateString } from '@/lib/utils/mealStatus';
import { requireRole } from '@/lib/auth/guards';
import {
  getMealCountsByDate,
  getStudentOptins,
  normalizeMealStatus,
  optInMeal,
  optInMealByDate,
} from '@/lib/api/mealOptinsMySQL';
import { getMysqlPool } from '@/lib/db/mysql';
import { emitRealtimeEvent, SOCKET_EVENTS } from '@/lib/socket/bridge';

export async function GET(request: Request) {
  const auth = await requireRole(request, ['student', 'staff', 'warden']);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || getIstDateString();
    const studentId = url.searchParams.get('studentId');

    if (studentId) {
      const rows = await getStudentOptins(studentId, date);
      return NextResponse.json({ rows });
    }

    const rows = await getMealCountsByDate(date);
    const counts = { breakfast: 0, lunch: 0, snack: 0, dinner: 0 };
    rows.forEach((row: any) => {
      const mt = String(row.meal_type) as keyof typeof counts;
      if (['breakfast', 'lunch', 'snack', 'dinner'].includes(String(row.meal_type))) {
        counts[mt] = Number(row.confirmed || 0);
      }
    });

    // Also fetch total registered students for diet distribution stats
    const pool = getMysqlPool();
    const totalStudents = await pool.query("SELECT COUNT(*) as count FROM users WHERE role = 'student'").then(([rows]: any) => rows[0].count);
    const dietStats = await pool.query("SELECT food_preference, COUNT(*) as count FROM users WHERE role = 'student' GROUP BY food_preference").then(([rows]: any) => {
      const stats: Record<string, number> = { veg: 0, non_veg: 0 };
      rows.forEach((r: any) => { 
        const pref = String(r.food_preference || 'veg').toLowerCase();
        if (pref === 'veg' || pref === 'non_veg') {
          stats[pref] = Number(r.count); 
        }
      });
      return stats;
    });

    return NextResponse.json({ counts, rows, totalStudents, dietStats });
  } catch (error) {
    console.error('meal-optins GET:', error);
    return NextResponse.json(
      { message: (error as Error).message || 'Failed to load meal opt-ins.' },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  return PUT(request);
}

export async function PUT(request: Request) {
  const auth = await requireRole(request, ['student']);
  if (!auth.ok) {
    return auth.response;
  }

  const { session } = auth;
  const studentId = session.sub;

  try {
    const body = await request.json();
    const bodyStudentId = String(body?.studentId ?? '').trim();
    if (bodyStudentId && bodyStudentId !== studentId) {
      console.warn(
        '[messmate][meal-optins][PUT] Ignoring body studentId; using session sub.',
        { sessionSub: studentId, bodyStudentId }
      );
    }

    const status = normalizeMealStatus(String(body?.status ?? 'attending'));

    const mealDate = String(body?.mealDate ?? '').trim();
    const mealType = String(body?.mealType ?? '').trim() as 'breakfast' | 'lunch' | 'snack' | 'dinner';

    try {
      if (body?.mealId) {
        const record = await optInMeal({
          studentId,
          mealId: String(body.mealId),
          status,
        });

        void emitRealtimeEvent(
          SOCKET_EVENTS.mealOptinsUpdated,
          { studentId, mealOptin: record },
          { rooms: [`user:${studentId}`], roles: ['staff', 'warden'] }
        );

        void emitRealtimeEvent(SOCKET_EVENTS.analyticsRefresh, { reason: 'meal-optin-updated', studentId }, { roles: ['staff', 'warden'] });

        return NextResponse.json({ row: record });
      }

      if (!mealDate || !mealType) {
        return NextResponse.json(
          { message: 'mealDate and mealType are required when mealId is not provided.' },
          { status: 400 }
        );
      }

      const record = await optInMealByDate({
        studentId,
        mealDate,
        mealType,
        status,
      });

      const counts = await getMealCountsByDate(mealDate);

      void emitRealtimeEvent(
        SOCKET_EVENTS.mealOptinsUpdated,
        { studentId, mealDate, mealType, status, mealOptin: record, counts },
        { rooms: [`user:${studentId}`], roles: ['staff', 'warden'] }
      );

      void emitRealtimeEvent(SOCKET_EVENTS.analyticsRefresh, { reason: 'meal-optin-updated', studentId, mealDate }, { roles: ['staff', 'warden'] });

      return NextResponse.json({ row: record });
    } catch (error) {
      console.error('MySQL opt-in error:', error);
      return NextResponse.json(
        {
          message: (error as Error)?.message || 'Failed to save opt-in.',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}
