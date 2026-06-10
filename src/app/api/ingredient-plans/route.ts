import { NextResponse, NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { getDailyIngredientPlan, saveDailyIngredientPlan } from '@/lib/api/ingredientPlanMySQL';
import { getIstDateString } from '@/lib/utils/mealStatus';

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['staff', 'warden']);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const date = String(url.searchParams.get('date') || getIstDateString(1));

  try {
    const plan = await getDailyIngredientPlan(date);
    return NextResponse.json({ date, plan });
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error).message || 'Unable to load ingredient plan' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['staff']);
  if (!auth.ok) return auth.response;

  const data = await request.json().catch(() => null);
  if (!data || typeof data !== 'object') {
    return NextResponse.json({ message: 'Invalid request payload' }, { status: 400 });
  }

  const date = String(data.date || getIstDateString(1));
  const items = Array.isArray(data.items) ? data.items : [];
  const notes = data.notes ? String(data.notes) : null;

  if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return NextResponse.json({ message: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
  }

  try {
    const plan = await saveDailyIngredientPlan(date, items, auth.session.sub);
    return NextResponse.json({ date, plan, notes });
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error).message || 'Unable to save ingredient plan' },
      { status: 500 }
    );
  }
}
