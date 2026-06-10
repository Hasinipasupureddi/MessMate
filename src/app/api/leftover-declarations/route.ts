import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { getIstDateString } from '@/lib/utils/mealStatus';
import { listLeftoverDeclarations, saveLeftoverDeclaration, deleteLeftoverDeclaration } from '@/lib/api/leftoversMySQL';

export async function GET(request: Request) {
  const auth = await requireRole(request, ['staff', 'warden']);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || getIstDateString();
    const declarations = await listLeftoverDeclarations(date);
    console.log('[LEFTOVER DECLARATIONS API RESPONSE]', JSON.stringify({ rows: declarations }, null, 2));
    return NextResponse.json({ rows: declarations });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireRole(request, ['staff']);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const mealType = String(body?.mealType || '').trim() as 'breakfast' | 'lunch' | 'snack' | 'dinner';
    const status = String(body?.status || '').trim() as 'declared' | 'none' | 'pending';
    const note = body?.note ? String(body.note).trim() : null;
    const dishName = body?.dishName ? String(body.dishName).trim() : null;
    const emoji = body?.emoji ? String(body.emoji).trim() : null;
    const totalPortions = body?.totalPortions ? Number(body.totalPortions) : null;
    const availableUntil = body?.availableUntil ? String(body.availableUntil).trim() : null;
    const mealDate = String(body?.mealDate || getIstDateString()).trim();

    if (!mealType || !['breakfast', 'lunch', 'snack', 'dinner'].includes(mealType)) {
      return NextResponse.json({ message: 'mealType is required and must be a valid meal.' }, { status: 400 });
    }

    if (!['declared', 'none', 'pending'].includes(status)) {
      return NextResponse.json({ message: 'status must be either declared, none, or pending.' }, { status: 400 });
    }

    if (status === 'declared') {
      if (!dishName || !totalPortions || totalPortions <= 0 || !availableUntil) {
        return NextResponse.json({ message: 'dishName, totalPortions, and availableUntil are required when declaring leftovers.' }, { status: 400 });
      }
    }

    const declaration = await saveLeftoverDeclaration({
      mealDate,
      mealType,
      status,
      declaredBy: auth.session.sub,
      note,
      dishName,
      emoji,
      totalPortions,
      availableUntil: availableUntil || null,
    });

    return NextResponse.json({ success: true, declaration });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireRole(request, ['staff']);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const mealType = url.searchParams.get('mealType') as 'breakfast' | 'lunch' | 'snack' | 'dinner';
    const mealDate = url.searchParams.get('mealDate') || getIstDateString();

    if (!mealType || !['breakfast', 'lunch', 'snack', 'dinner'].includes(mealType)) {
      return NextResponse.json({ message: 'mealType is required.' }, { status: 400 });
    }

    await deleteLeftoverDeclaration(mealDate, mealType);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}
