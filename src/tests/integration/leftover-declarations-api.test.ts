/** @jest-environment node */

import { GET as GET_DECLARATIONS, POST as POST_DECLARATIONS } from '@/app/api/leftover-declarations/route';
import { GET as GET_CHECKLIST, PATCH as PATCH_CHECKLIST } from '@/app/api/leftover-checklist/route';
import {
  listLeftoverDeclarations,
  saveLeftoverDeclaration,
  listLeftoverChecklistItems,
  toggleLeftoverChecklistItem,
} from '@/lib/api/leftoversMySQL';
import { requireRole } from '@/lib/auth/guards';

jest.mock('@/lib/api/leftoversMySQL', () => ({
  listLeftoverDeclarations: jest.fn(),
  saveLeftoverDeclaration: jest.fn(),
  listLeftoverChecklistItems: jest.fn(),
  toggleLeftoverChecklistItem: jest.fn(),
}));

jest.mock('@/lib/auth/guards', () => ({
  requireRole: jest.fn(),
}));

describe('Leftover declaration and checklist API', () => {
  const mockedListLeftoverDeclarations = jest.mocked(listLeftoverDeclarations);
  const mockedSaveLeftoverDeclaration = jest.mocked(saveLeftoverDeclaration);
  const mockedListLeftoverChecklistItems = jest.mocked(listLeftoverChecklistItems);
  const mockedToggleLeftoverChecklistItem = jest.mocked(toggleLeftoverChecklistItem);
  const mockedRequireRole = jest.mocked(requireRole);

  beforeEach(() => {
    jest.resetAllMocks();
    mockedRequireRole.mockResolvedValue({ ok: true, session: { sub: 'demo-staff-1', role: 'staff' } } as any);
  });

  it('returns leftover declarations for today', async () => {
    mockedListLeftoverDeclarations.mockResolvedValue([
      {
        id: 'leftover-declaration-2026-06-05-lunch',
        meal_date: '2026-06-05',
        meal_type: 'lunch',
        status: 'declared',
        declared_by: 'demo-staff-1',
        note: 'Extra curry available',
        dish_name: 'Rice + Curry',
        emoji: '🍛',
        total_portions: 12,
        available_until: '2026-06-05T18:00:00.000Z',
        is_active: true,
        created_at: '2026-06-05T10:00:00.000Z',
        updated_at: '2026-06-05T10:00:00.000Z',
      },
    ]);

    const response = await GET_DECLARATIONS(new Request('http://localhost/api/leftover-declarations?date=2026-06-05'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]).toMatchObject({ meal_type: 'lunch', status: 'declared' });
  });

  it('allows staff to declare leftovers', async () => {
    mockedSaveLeftoverDeclaration.mockResolvedValue({
      id: 'leftover-declaration-2026-06-05-lunch',
      meal_date: '2026-06-05',
      meal_type: 'lunch',
      status: 'declared',
      declared_by: 'demo-staff-1',
      note: null,
      dish_name: 'Rice + Curry',
      emoji: '🍛',
      total_portions: 12,
      available_until: '2026-06-05T18:00:00.000Z',
      is_active: true,
      created_at: '2026-06-05T10:00:00.000Z',
      updated_at: '2026-06-05T10:00:00.000Z',
    } as any);

    const request = new Request('http://localhost/api/leftover-declarations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mealType: 'lunch',
        status: 'declared',
        mealDate: '2026-06-05',
        dishName: 'Rice + Curry',
        emoji: '🍛',
        totalPortions: 12,
        availableUntil: '2026-06-05T18:00:00.000Z',
      }),
    });

    const response = await POST_DECLARATIONS(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedSaveLeftoverDeclaration).toHaveBeenCalledWith(expect.objectContaining({ mealType: 'lunch', status: 'declared' }));
    expect(body.success).toBe(true);
    expect(body.declaration).toMatchObject({ meal_type: 'lunch', status: 'declared' });
  });

  it('returns checklist items and totals', async () => {
    mockedListLeftoverChecklistItems.mockResolvedValue([
      { id: 'checklist-2026-06-05-declare_leftovers', checklist_date: '2026-06-05', item_key: 'declare_leftovers', label: 'Confirm today’s leftovers are declared', is_done: false, created_at: '2026-06-05T10:00:00.000Z', updated_at: '2026-06-05T10:00:00.000Z' },
      { id: 'checklist-2026-06-05-notify_students', checklist_date: '2026-06-05', item_key: 'notify_students', label: 'Notify students about leftover availability', is_done: true, created_at: '2026-06-05T10:00:00.000Z', updated_at: '2026-06-05T10:00:00.000Z' },
    ] as any);

    const response = await GET_CHECKLIST(new Request('http://localhost/api/leftover-checklist?date=2026-06-05'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.completedCount).toBe(1);
    expect(body.totalCount).toBe(2);
    expect(body.items).toHaveLength(2);
  });

  it('updates a checklist item status', async () => {
    mockedToggleLeftoverChecklistItem.mockResolvedValue({
      id: 'checklist-2026-06-05-declare_leftovers',
      checklist_date: '2026-06-05',
      item_key: 'declare_leftovers',
      label: 'Confirm today’s leftovers are declared',
      is_done: true,
      created_at: '2026-06-05T10:00:00.000Z',
      updated_at: '2026-06-05T10:01:00.000Z',
    } as any);

    const request = new Request('http://localhost/api/leftover-checklist', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2026-06-05', itemKey: 'declare_leftovers', isDone: true }),
    });

    const response = await PATCH_CHECKLIST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.item).toMatchObject({ item_key: 'declare_leftovers', is_done: true });
  });
});
