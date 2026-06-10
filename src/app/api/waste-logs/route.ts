import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { getWasteLogs, createWasteLog } from '@/lib/api/wasteMySQL';
import { getIstDateString } from '@/lib/utils/mealStatus';

export async function GET(request: Request) {
  const auth = await requireRole(request, ['staff', 'warden']);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || getIstDateString();

    const rows = await getWasteLogs(date);
    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireRole(request, ['staff']);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { logDate, mealType, dishName, amount, unit, reason } = body;

    if (!mealType || !dishName || !amount || !unit) {
      return NextResponse.json({ message: 'Missing required fields.' }, { status: 400 });
    }

    const result = await createWasteLog({
      staffId: auth.session.sub,
      logDate: logDate || getIstDateString(),
      mealType,
      dishName,
      amount,
      unit,
      reason,
    });

    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}
