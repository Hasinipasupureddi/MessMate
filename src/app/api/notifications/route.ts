import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { getNotifications, markAsRead } from '@/lib/api/notificationsMySQL';

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const rows = await getNotifications(auth.session.sub);
    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ message: 'Notification ID required' }, { status: 400 });
    }

    await markAsRead(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}
