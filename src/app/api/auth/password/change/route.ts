import { NextResponse } from 'next/server';
import { changePasswordWithCurrentCredentials } from '@/lib/api/passwordMySQL';
import { getSessionFromRequest } from '@/lib/auth/session';

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const currentPassword = String((body as { currentPassword?: unknown })?.currentPassword ?? '');
  const newPassword = String((body as { newPassword?: unknown })?.newPassword ?? '');

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ message: 'Current password and new password are required.' }, { status: 400 });
  }

  try {
    await changePasswordWithCurrentCredentials(session.email, currentPassword, newPassword);
    return NextResponse.json({ message: 'Password updated successfully.' });
  } catch (error) {
    const message = (error as Error)?.message || 'Failed to change password.';
    const status = message.toLowerCase().includes('invalid credentials') ? 401 : 400;
    return NextResponse.json({ message }, { status });
  }
}