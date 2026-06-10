import { NextResponse } from 'next/server';
import { getIstDateString } from '@/lib/utils/mealStatus';
import { getMealsByDate } from '@/lib/api/mealOptins';
import { requireAuth } from '@/lib/auth/guards';

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || getIstDateString();
    const rows = await getMealsByDate(date);
    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}