import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { getVoteOptionsForDate, updateVoteOption, addVoteOption, deleteVoteOption } from '@/lib/api/voteOptionsMySQL';
import { getIstDateString } from '@/lib/utils/mealStatus';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || getIstDateString(1);
    const force = url.searchParams.get('force') === 'true';
    const mealType = url.searchParams.get('mealType');
    const options = await getVoteOptionsForDate(date, force, mealType || undefined);
    return NextResponse.json({ options });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireRole(request, ['staff', 'warden']);
  if (!auth.ok) return auth.response;

  try {
    const { date, mealType, categoryKey, option } = await request.json();
    if (!date || !mealType || !option) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }
    await addVoteOption(date, mealType, categoryKey, option);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireRole(request, ['staff', 'warden']);
  if (!auth.ok) return auth.response;

  try {
    const { date, option } = await request.json();
    if (!date || !option?.id || !option?.mealType) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }
    await updateVoteOption(date, option);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireRole(request, ['staff', 'warden']);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const mealType = url.searchParams.get('mealType');
    const optionId = url.searchParams.get('optionId');

    if (!date || !mealType || !optionId) {
      return NextResponse.json({ message: 'Missing required parameters' }, { status: 400 });
    }

    await deleteVoteOption(date, mealType as any, optionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}
