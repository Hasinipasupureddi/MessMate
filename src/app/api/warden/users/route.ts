import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { listUsersByStatus, updateUserAccountStatus, type AccountStatus } from '@/lib/api/authMySQL';

const VALID_ACCOUNT_STATUSES: AccountStatus[] = ['pending', 'approved', 'rejected', 'disabled'];

export async function GET(request: Request) {
  const auth = await requireRole(request, ['warden']);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const status = String(url.searchParams.get('status') || 'pending') as AccountStatus;
  if (!VALID_ACCOUNT_STATUSES.includes(status)) {
    return NextResponse.json({ message: 'Invalid status filter.' }, { status: 400 });
  }

  const users = await listUsersByStatus(status);
  return NextResponse.json({ users });
}

export async function PATCH(request: Request) {
  const auth = await requireRole(request, ['warden']);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const userId = String((body as { userId?: unknown })?.userId ?? '').trim();
  const status = String((body as { status?: unknown })?.status ?? '').trim() as AccountStatus;

  if (!userId || !VALID_ACCOUNT_STATUSES.includes(status)) {
    return NextResponse.json({ message: 'Invalid user or status.' }, { status: 400 });
  }

  await updateUserAccountStatus(userId, status);
  return NextResponse.json({ success: true, userId, status });
}
