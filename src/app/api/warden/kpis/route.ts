import { NextResponse } from 'next/server';
import { getIstDateString } from '@/lib/utils/mealStatus';
import { getWardenKpis } from '@/lib/api/wardenKpisMySQL';
import { requireRole } from '@/lib/auth/guards';

export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, ['warden']);
    if (!auth.ok) return auth.response;
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || getIstDateString();

    const kpis = await getWardenKpis(date);
    return NextResponse.json(kpis);
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}
