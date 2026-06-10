import { NextResponse, NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { createPurchaseRequest, getPurchaseRequests, updatePurchaseRequestStatus } from '@/lib/api/ingredientInventoryMySQL';

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['staff', 'warden']);
  if (!auth.ok) return auth.response;

  const requests = await getPurchaseRequests();
  return NextResponse.json({ requests });
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['staff']);
  if (!auth.ok) return auth.response;

  const data = await request.json().catch(() => null);
  if (!data || typeof data !== 'object') {
    return NextResponse.json({ message: 'Invalid request payload' }, { status: 400 });
  }

  const ingredientId = String(data.ingredientId || '').trim();
  const requestedQty = Number(data.requestedQty ?? NaN);
  const notes = data.notes ? String(data.notes) : null;

  if (!ingredientId || Number.isNaN(requestedQty) || requestedQty <= 0) {
    return NextResponse.json({ message: 'Missing or invalid purchase request fields' }, { status: 400 });
  }

  try {
    const requestRow = await createPurchaseRequest({
      ingredientId,
      requestedQty,
      notes,
      requestedBy: auth.session.sub,
    });
    return NextResponse.json({ request: requestRow });
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error).message || 'Unable to create purchase request' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRole(request, ['staff', 'warden']);
  if (!auth.ok) return auth.response;

  const data = await request.json().catch(() => null);
  if (!data || typeof data !== 'object') {
    return NextResponse.json({ message: 'Invalid request payload' }, { status: 400 });
  }

  const id = String(data.id || '').trim();
  const status = String(data.status || '').trim() as 'requested' | 'ordered' | 'received' | 'cancelled';
  const validStatuses = ['requested', 'ordered', 'received', 'cancelled'];

  if (!id || !validStatuses.includes(status)) {
    return NextResponse.json({ message: 'Missing or invalid request status update' }, { status: 400 });
  }

  try {
    const updated = await updatePurchaseRequestStatus({ id, status });
    return NextResponse.json({ request: updated });
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error).message || 'Unable to update purchase request' },
      { status: 500 }
    );
  }
}
