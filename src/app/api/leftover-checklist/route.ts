import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { getIstDateString } from '@/lib/utils/mealStatus';
import { listLeftoverChecklistItems, toggleLeftoverChecklistItem } from '@/lib/api/leftoversMySQL';

export async function GET(request: Request) {
  const auth = await requireRole(request, ['staff', 'warden']);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || getIstDateString();
    const items = await listLeftoverChecklistItems(date);
    const completedCount = items.filter((item) => item.is_done).length;
    const totalCount = items.length;
    return NextResponse.json({ items, completedCount, totalCount });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireRole(request, ['staff']);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const date = String(body?.date || getIstDateString()).trim();
    const itemKey = String(body?.itemKey || '').trim();
    const isDone = Boolean(body?.isDone);

    if (!itemKey) {
      return NextResponse.json({ message: 'itemKey is required.' }, { status: 400 });
    }

    const item = await toggleLeftoverChecklistItem(date, itemKey, isDone);
    if (!item) {
      return NextResponse.json({ message: 'Checklist item not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, item });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}
