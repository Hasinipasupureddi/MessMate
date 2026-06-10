import { NextResponse } from 'next/server';
import { getReportData } from '@/lib/api/reportMySQL';
import { getIstDateString } from '@/lib/utils/mealStatus';

export async function GET() {
  try {
    console.log('[api/reports/data] Starting');
    const date = getIstDateString();
    console.log('[api/reports/data] Date:', date);
    const reportData = await getReportData(date);
    console.log('[api/reports/data] Success, returning:', reportData);
    return NextResponse.json(reportData);
  } catch (error) {
    console.error('[api/reports/data] Failed to get report data:', error);
    return NextResponse.json({ 
      error: 'Failed to get report data', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
