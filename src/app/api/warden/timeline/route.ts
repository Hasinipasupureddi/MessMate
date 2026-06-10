import { NextResponse } from 'next/server';
import { getIstDateString, toSqlDatetime } from '@/lib/utils/mealStatus';
import { getMysqlPool } from '@/lib/db/mysql';
import { requireRole } from '@/lib/auth/guards';

export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, ['warden']);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const date = url.searchParams.get('date') || getIstDateString();
    const tomorrow = getIstDateString(1);

    const pool = getMysqlPool();

    // 1. Get Leftover Declarations (Meal Served events)
    const [declarations] = await pool.execute(
      `SELECT meal_type, status, created_at, updated_at 
       FROM leftover_declarations 
       WHERE meal_date = ? AND status != 'pending'`,
      [date]
    );

    // 2. Get Tomorrow's Menu Submission
    const [menuRows] = await pool.execute(
      `SELECT meal_type, generated_at, updated_at, status 
       FROM final_menu 
       WHERE menu_date = ?`,
      [tomorrow]
    );

    // 3. Get Warden Approvals
    const [approvals] = await pool.execute(
      `SELECT action, created_at 
       FROM warden_menu_feedback 
       WHERE menu_date = ?`,
      [tomorrow]
    );

    const events: any[] = [];

    // Map declarations to events
    (declarations as any[]).forEach(d => {
      const time = new Date(d.updated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      events.push({
        time,
        timestamp: new Date(d.updated_at).getTime(),
        title: `${d.meal_type.charAt(0).toUpperCase() + d.meal_type.slice(1)} Served`,
        description: d.status === 'declared' ? 'Leftovers were declared.' : 'No leftovers today.',
        type: 'meal'
      });
    });

    // Map menu submission
    if ((menuRows as any[]).length > 0) {
      const firstGenerated = (menuRows as any[]).reduce((min, r) => 
        new Date(r.generated_at).getTime() < new Date(min.generated_at).getTime() ? r : min
      );
      events.push({
        time: new Date(firstGenerated.generated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date(firstGenerated.generated_at).getTime(),
        title: 'Tomorrow Menu Submitted',
        description: 'Staff has finalized the draft for tomorrow.',
        type: 'submission'
      });
    }

    // Map approvals
    (approvals as any[]).forEach(a => {
      events.push({
        time: new Date(a.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date(a.created_at).getTime(),
        title: a.action === 'approve' ? 'Menu Approved' : 'Changes Requested',
        description: a.action === 'approve' ? 'Warden authorized tomorrow’s menu.' : 'Warden sent feedback to staff.',
        type: a.action === 'approve' ? 'approval' : 'feedback'
      });
    });

    // Sort events by timestamp
    events.sort((a, b) => a.timestamp - b.timestamp);

    return NextResponse.json({ events });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}
