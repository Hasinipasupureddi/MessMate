/** @jest-environment node */

import { GET, PUT } from '@/app/api/inventory/route';
import { GET as GET_PURCHASE, POST as POST_PURCHASE } from '@/app/api/purchase-requests/route';

jest.mock('@/lib/auth/guards', () => ({ requireRole: jest.fn() }));
import { requireRole } from '@/lib/auth/guards';
const mockedRequireRole = jest.mocked(requireRole as any);

describe('Inventory and procurement API', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedRequireRole.mockResolvedValue({ ok: true, session: { sub: 'demo-staff-1', role: 'staff' } });
  });

  it('returns current inventory', async () => {
    const request = new Request('http://localhost/api/inventory');
    const response = await GET(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(body.inventory)).toBe(true);
    expect(typeof body.lowStockCount).toBe('number');
    expect(body.inventory.some((item: any) => item.ingredient_name === 'Rice')).toBe(true);
  });

  it('creates a purchase request', async () => {
    const request = new Request('http://localhost/api/purchase-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredientId: 'ing-idly-batter', requestedQty: 5, notes: 'Test order' }),
    });

    const response = await POST_PURCHASE(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.request).toMatchObject({ ingredient_id: 'ing-idly-batter', requestedQty: 5, status: 'requested' });
  });

  it('updates inventory stock values', async () => {
    const request = new Request('http://localhost/api/inventory', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredientId: 'ing-rice', currentStock: 80, reorderThreshold: 20 }),
    });

    const response = await PUT(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.inventoryItem).toMatchObject({ ingredient_id: 'ing-rice', current_stock: 80, reorder_threshold: 20 });
  });
});
