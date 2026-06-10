import { NextResponse } from 'next/server';
import { getIstDateString } from '@/lib/utils/mealStatus';
import { getMealCountsByDate } from '@/lib/api/mealOptinsMySQL';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || getIstDateString();
    const rows = await getMealCountsByDate(date);

    const counts: Record<'breakfast' | 'lunch' | 'snack' | 'dinner', number> = {
      breakfast: 0,
      lunch: 0,
      snack: 0,
      dinner: 0,
    };

    rows.forEach((row: any) => {
      const mt = String(row.meal_type) as keyof typeof counts;
      if (['breakfast', 'lunch', 'snack', 'dinner'].includes(String(row.meal_type))) {
        counts[mt] = Number(row.confirmed || 0);
      }
    });

    return NextResponse.json({ counts, rows });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}
