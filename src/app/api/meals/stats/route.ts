import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { getMealStats } from '@/lib/api/mealOptinsMySQL';
import { getIstDateString } from '@/lib/utils/mealStatus';

export async function GET(request: Request) {
  const auth = await requireRole(request, ['warden']);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate') || getIstDateString(-6);
    const endDate = url.searchParams.get('endDate') || getIstDateString();

    const rows = await getMealStats(startDate, endDate);
    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}
