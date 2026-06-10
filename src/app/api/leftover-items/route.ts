import { NextResponse } from 'next/server';
import { getIstDateString, getIstNow, parseIstDatetime } from '@/lib/utils/mealStatus';
import { listLeftovers, listLeftoverDeclarations } from '@/lib/api/leftoversMySQL';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || getIstDateString();
    const leftovers = await listLeftovers(date);
    const declarations = await listLeftoverDeclarations(date);

    // Filter rows again in the API to be absolutely sure no stale/expired data leaks.
    // Use IST-aware parsing so delivery matches the rest of the application.
    const now = getIstNow();
    const rows = leftovers.filter(item => {
      const availableDate = parseIstDatetime(String(item.available_until));
      return availableDate > now && item.claimed_count < item.total_portions;
    }).map((item) => ({
      id: item.id,
      meal_date: item.meal_date,
      meal_type: item.meal_type,
      dish_name: item.dish_name,
      emoji: item.emoji,
      total_portions: item.total_portions,
      claimed_count: item.claimed_count,
      available_until: item.available_until,
      is_active: item.is_active,
    }));

    const overallStatus = rows.length > 0
      ? 'declared'
      : declarations.length === 0
      ? 'pending'
      : declarations.some((d) => d.status === 'declared')
      ? 'declared'
      : declarations.every((d) => d.status === 'none')
      ? 'none'
      : 'pending';

    const mealStatuses = declarations.map((declaration) => ({
      meal_type: declaration.meal_type,
      status: declaration.status,
      note: declaration.note,
    }));

    const response = { rows, declaration: { overallStatus, meals: mealStatuses } };
    console.log('[LEFTOVER API RESPONSE]', JSON.stringify(response, null, 2));

    return NextResponse.json(response);
  } catch (error) {
    console.error('[LEFTOVER API ERROR]', error);
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}
