import { NextResponse } from 'next/server';
import { createUser, type ProfileRole } from '@/lib/api/authMySQL';

function normalizeRole(input: string): ProfileRole | null {
  if (input === 'student' || input === 'warden' || input === 'staff') {
    return input;
  }

  return null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const rollNo = String((body as { rollNo?: unknown })?.rollNo ?? '').trim();
  const email = String((body as { email?: unknown })?.email ?? '').trim().toLowerCase();
  const password = String((body as { password?: unknown })?.password ?? '');
  const name = String((body as { name?: unknown })?.name ?? 'MessMate User').trim() || 'MessMate User';
  const roleInput = String((body as { role?: unknown })?.role ?? 'student');
  const role = normalizeRole(roleInput);
  const hostelId = String((body as { hostelId?: unknown })?.hostelId ?? 'A').trim() || 'A';
  const foodPreference = String((body as { foodPreference?: unknown })?.foodPreference ?? 'non_veg').trim() as 'veg' | 'non_veg';

  try {
    if (!email || !password) {
      return NextResponse.json({ message: 'Email and password are required.' }, { status: 400 });
    }

    if (role === 'student' && !rollNo) {
      return NextResponse.json({ message: 'Roll Number is required for students.' }, { status: 400 });
    }

    if (!role) {
      return NextResponse.json({ message: 'Invalid role.' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ message: 'Password must be at least 8 characters long.' }, { status: 400 });
    }

    const user = await createUser({
      rollNo,
      email,
      password,
      name,
      role,
      hostelId,
      foodPreference,
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          foodPreference: user.foodPreference,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message = (error as Error)?.message || 'Failed to sign up.';
    const status = message.toLowerCase().includes('already registered') ? 409 : 500;
    return NextResponse.json({ message }, { status });
  }
}
