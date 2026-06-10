import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { claimLeftover } from '@/lib/api/leftoversMySQL';

export async function POST(request: Request) {
  try {
    const auth = await requireRole(request, ['student']);
    if (!auth.ok) {
      return auth.response;
    }

    const body = await request.json();
    const leftoverId = String(body?.leftoverId ?? '');
    const userId = auth.session.sub;

    if (!leftoverId) {
      return NextResponse.json({ success: false, message: 'leftoverId is required.' }, { status: 400 });
    }

    const result = await claimLeftover({ leftoverId, userId });
    if (!result.success) {
      const status =
        result.message === 'Item not found.' ? 404 :
        result.message === 'Claim window is closed.' ? 409 :
        result.message === 'No portions left.' ? 409 :
        result.message === 'You already claimed this item.' ? 409 :
        400;

      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
