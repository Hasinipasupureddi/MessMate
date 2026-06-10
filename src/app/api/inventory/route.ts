import { NextResponse, NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { getInventoryList, updateInventoryStock } from '@/lib/api/ingredientInventoryMySQL';

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['staff', 'warden']);
  if (!auth.ok) return auth.response;

  const inventory = await getInventoryList();
  const lowStockItems = inventory.filter((item) => item.current_stock <= item.reorder_threshold);

  return NextResponse.json({
    inventory,
    lowStockCount: lowStockItems.length,
    hasLowStock: lowStockItems.length > 0,
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireRole(request, ['staff']);
  if (!auth.ok) return auth.response;

  const data = await request.json().catch(() => null);
  if (!data || typeof data !== 'object') {
    return NextResponse.json({ message: 'Invalid request payload' }, { status: 400 });
  }

  const ingredientId = String(data.ingredientId || '').trim();
  const currentStock = Number(data.currentStock ?? NaN);
  const reorderThreshold = Number(data.reorderThreshold ?? NaN);

  if (!ingredientId || Number.isNaN(currentStock) || Number.isNaN(reorderThreshold)) {
    return NextResponse.json({ message: 'Missing or invalid inventory update fields' }, { status: 400 });
  }

  try {
    const updated = await updateInventoryStock({ ingredientId, currentStock, reorderThreshold });
    return NextResponse.json({ inventoryItem: updated });
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error).message || 'Unable to update inventory' },
      { status: 500 }
    );
  }
}
