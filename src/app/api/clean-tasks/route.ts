import { NextResponse } from 'next/server';
import { getMysqlPool } from '@/lib/db/mysql';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  const pool = getMysqlPool();
  
  if (date) {
    await pool.execute('DELETE FROM cooking_tasks WHERE task_date = ?', [date]);
  } else {
    await pool.execute('DELETE FROM cooking_tasks');
  }
  
  return NextResponse.json({ success: true, message: `Deleted tasks` });
}
