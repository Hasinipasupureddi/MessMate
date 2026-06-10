import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { getMysqlPool } from '@/lib/db/mysql';
import { ensureMysqlSchema } from '@/lib/db/init';
import { getIstDateString } from '@/lib/utils/mealStatus';

export async function GET(request: Request) {
  const auth = await requireRole(request, ['staff', 'warden']);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const range = Number(url.searchParams.get('range') || '7');
    const pool = getMysqlPool();
    await ensureMysqlSchema();

    // Build last N days list
    const days: string[] = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = getIstDateString(-i);
      days.push(d);
    }

    // Daily totals grouped by meal_type
    const dailyRows: Array<any> = [];
    for (const day of days) {
      const [rows] = await pool.execute(
        `SELECT meal_type, COALESCE(SUM(amount),0) as total
         FROM waste_logs WHERE log_date = ? AND unit = 'kg' GROUP BY meal_type`,
        [day]
      );

      const rowMap: Record<string, number> = { breakfast: 0, lunch: 0, snack: 0, dinner: 0 };
      (rows as any[]).forEach(r => {
        rowMap[r.meal_type] = Number(r.total || 0);
      });

      dailyRows.push({ date: day, ...rowMap });
    }

    // Monthly (current month) totals grouped by meal_type
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
    const [mealTotalsRows] = await pool.execute(
      `SELECT meal_type, COALESCE(SUM(amount),0) as total FROM waste_logs WHERE log_date >= ? AND unit = 'kg' GROUP BY meal_type`,
      [monthStart]
    );

    const mealTotals: { meal: string; waste: number }[] = [];
    let total = 0;
    (mealTotalsRows as any[]).forEach(r => { mealTotals.push({ meal: r.meal_type, waste: Number(r.total || 0) }); total += Number(r.total || 0); });

    const mealBreakdown = mealTotals.map(m => ({ meal: m.meal, waste: m.waste, percentage: total > 0 ? Math.round((m.waste / total) * 100) : 0 }));

    return NextResponse.json({ daily: dailyRows, mealBreakdown, total });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}
