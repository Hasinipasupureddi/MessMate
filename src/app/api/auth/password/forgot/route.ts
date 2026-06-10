import { NextResponse } from 'next/server';
import { requestPasswordReset } from '@/lib/api/passwordMySQL';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String((body as { email?: unknown })?.email ?? '').trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ message: 'Email is required.' }, { status: 400 });
  }

  try {
    const result = await requestPasswordReset(email);
    return NextResponse.json({
      message: 'If the email exists, a reset link has been generated.',
      resetUrl: process.env.NODE_ENV === 'production' ? undefined : result?.resetUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error)?.message || 'Failed to request password reset.' },
      { status: 500 }
    );
  }
}