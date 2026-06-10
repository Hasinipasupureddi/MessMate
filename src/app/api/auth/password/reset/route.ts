import { NextResponse } from 'next/server';
import { resetPasswordWithToken } from '@/lib/api/passwordMySQL';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = String((body as { token?: unknown })?.token ?? '').trim();
  const newPassword = String((body as { newPassword?: unknown })?.newPassword ?? '');

  if (!token || !newPassword) {
    return NextResponse.json({ message: 'Token and new password are required.' }, { status: 400 });
  }

  try {
    await resetPasswordWithToken(token, newPassword);
    return NextResponse.json({ message: 'Password reset successfully.' });
  } catch (error) {
    const message = (error as Error)?.message || 'Failed to reset password.';
    const status = message.toLowerCase().includes('invalid or expired') ? 400 : 500;
    return NextResponse.json({ message }, { status });
  }
}