import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { getIstDateString } from '@/lib/utils/mealStatus';
import { getFinalMenuRowsRange, hydrateFinalMenuDay } from '@/lib/api/finalMenuMySQL';

function getDateOffset(baseDate: string, offset: number) {
  const date = new Date(`${baseDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const auth = await requireRole(request, ['warden']);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const filter = url.searchParams.get('filter') || 'last7';
  const startDateParam = url.searchParams.get('startDate');
  const endDateParam = url.searchParams.get('endDate');

  const today = getIstDateString();
  const endDate = endDateParam || today;
  let startDate = startDateParam || '';

  if (!startDate) {
    if (filter === 'last30') {
      startDate = getDateOffset(endDate, -29);
    } else {
      startDate = getDateOffset(endDate, -6);
    }
  }

  const rows = await getFinalMenuRowsRange(startDate, endDate);
  const grouped = rows.reduce<Record<string, typeof rows>>((acc, row) => {
    if (!acc[row.menuDate]) {
      acc[row.menuDate] = [];
    }
    acc[row.menuDate].push(row);
    return acc;
  }, {});

  const history = Object.entries(grouped).map(([date, rowsForDate]) => {
    const menu = hydrateFinalMenuDay(date, rowsForDate);
    
    // Logic: if date is past, it's implicitly approved/served
    const isPast = date < today;
    const status = (menu.status === 'approved' || isPast) ? 'Approved' : 'Awaiting approval';
    
    return {
      date,
      status,
      meals: menu.meals.map((meal) => ({
        mealType: meal.mealType,
        label: meal.title,
        items: meal.winningItems.map((item) => item.label),
        winnerSource: meal.winnerSource,
        overrideReason: meal.overrideReason,
        generatedAt: menu.generatedAt,
        updatedAt: (meal as any).updatedAt,
      })),
    };
  });

  return NextResponse.json({ history });
}
