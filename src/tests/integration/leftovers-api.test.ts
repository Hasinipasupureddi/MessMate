/** @jest-environment node */

import { GET as GET_ITEMS } from '@/app/api/leftover-items/route';
import { POST as CLAIM_LEFTOVER } from '@/app/api/leftover-claims/route';
import { claimLeftover, listLeftovers, listLeftoverDeclarations } from '@/lib/api/leftoversMySQL';
import { requireRole } from '@/lib/auth/guards';

jest.mock('@/lib/api/leftoversMySQL', () => ({
  listLeftovers: jest.fn(),
  listLeftoverDeclarations: jest.fn(),
  claimLeftover: jest.fn(),
}));

jest.mock('@/lib/auth/guards', () => ({
  requireRole: jest.fn(),
}));

describe('Leftovers API smoke coverage', () => {
  const mockedListLeftovers = jest.mocked(listLeftovers);
  const mockedListLeftoverDeclarations = jest.mocked(listLeftoverDeclarations);
  const mockedClaimLeftover = jest.mocked(claimLeftover);
  const mockedRequireRole = jest.mocked(requireRole);

  beforeEach(() => {
    jest.resetAllMocks();
    mockedListLeftoverDeclarations.mockResolvedValue([]);
  });

  it('returns active leftovers for today', async () => {
    mockedListLeftovers.mockResolvedValue([
      {
        id: 'leftover-2026-05-14-lunch',
        meal_date: '2026-05-14',
        meal_type: 'lunch',
        dish_name: 'Rice + Dal + Curry',
        emoji: '🍛',
        total_portions: 18,
        claimed_count: 7,
        available_until: '2026-05-14T15:00:00.000Z',
        is_active: 1,
        status: 'available',
      },
    ]);

    const response = await GET_ITEMS(new Request('http://localhost/api/leftover-items?date=2026-05-14'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]).toMatchObject({
      id: 'leftover-2026-05-14-lunch',
      meal_type: 'lunch',
      dish_name: 'Rice + Dal + Curry',
    });
  });

  it('claims a leftover through the MySQL layer', async () => {
    mockedRequireRole.mockResolvedValue({
      ok: true,
      session: {
        sub: 'demo-student-1',
        email: 'arjun.mehta@messmate.in',
        name: 'Arjun Mehta',
        role: 'student',
        hostelId: 'A',
      },
    });
    mockedClaimLeftover.mockResolvedValue({ success: true, message: 'Claim successful.' });

    const request = new Request('http://localhost/api/leftover-claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leftoverId: 'leftover-2026-05-14-lunch' }),
    });

    const response = await CLAIM_LEFTOVER(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedClaimLeftover).toHaveBeenCalledWith({
      leftoverId: 'leftover-2026-05-14-lunch',
      userId: 'demo-student-1',
    });
    expect(body).toEqual({ success: true, message: 'Claim successful.' });
  });
});