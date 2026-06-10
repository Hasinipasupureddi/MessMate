import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { getBudgetSettings, saveBudgetSettings, getVendors, getPurchases, savePurchase, getMonthlyFinancialTrends, getMealCostConfig } from '@/lib/api/financeMySQL';
import { getIstDateString } from '@/lib/utils/mealStatus';

export async function GET(request: Request) {
  const auth = await requireRole(request, ['staff', 'warden']);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const hostelId = url.searchParams.get('hostelId') || 'A';
  const startDate = url.searchParams.get('startDate') || getIstDateString(-30);
  const endDate = url.searchParams.get('endDate') || getIstDateString();

  try {
    if (type === 'budget') {
      const budget = await getBudgetSettings(hostelId);
      return NextResponse.json({ budget });
    }
    if (type === 'vendors') {
      const vendors = await getVendors();
      return NextResponse.json({ vendors });
    }
    if (type === 'purchases') {
      const purchases = await getPurchases(startDate, endDate);
      return NextResponse.json({ purchases });
    }
    if (type === 'trends') {
      const trends = await getMonthlyFinancialTrends(hostelId);
      return NextResponse.json({ trends });
    }
    if (type === 'meal-costs') {
      const config = await getMealCostConfig();
      return NextResponse.json({ config });
    }
    return NextResponse.json({ message: 'Invalid type' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireRole(request, ['staff', 'warden']);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const type = body.type;

    if (type === 'budget') {
      await saveBudgetSettings(body.settings);
      return NextResponse.json({ message: 'Budget updated' });
    }
    if (type === 'purchase') {
      await savePurchase({
        ...body.purchase,
        staff_id: auth.session!.sub
      });
      return NextResponse.json({ message: 'Purchase recorded' });
    }
    return NextResponse.json({ message: 'Invalid type' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
