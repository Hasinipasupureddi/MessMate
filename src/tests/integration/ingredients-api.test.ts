/** @jest-environment node */

import { GET } from '@/app/api/ingredients/calculate/route';

jest.mock('@/lib/auth/guards', () => ({ requireRole: jest.fn() }));
import { requireRole } from '@/lib/auth/guards';
const mockedRequireRole = jest.mocked(requireRole as any);

describe('Ingredients calculate API smoke coverage', () => {
  beforeEach(() => { jest.resetAllMocks(); mockedRequireRole.mockResolvedValue({ ok: true, session: { sub: 'demo-staff-1', role: 'staff' } }); });

  it('returns a deterministic calculation payload', async () => {
    const request = new Request('http://localhost/api/ingredients/calculate?headcount=250&buffer=5&date=2026-06-08');
    const response = await GET(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.calculation).toEqual({
      headcount: 250,
      bufferPercent: 5,
      effectiveHeadcount: 263,
    });
    expect(Array.isArray(body.ingredients)).toBe(true);
    expect(body.ingredients.length).toBeGreaterThanOrEqual(8);
    const riceItem = body.ingredients.find((item: any) => item.name === 'Rice');
    expect(riceItem).toBeDefined();
    expect(riceItem).toMatchObject({
      required: 78.9,
      stockOk: true,
    });
    expect(body.shortage.shortageCount).toBeGreaterThan(0);
    expect(body.summary.grain.count).toBeGreaterThanOrEqual(2);
  });

  it('rejects invalid headcount values', async () => {
    const request = new Request('http://localhost/api/ingredients/calculate?headcount=0&buffer=10');
    const response = await GET(request as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      message: 'Invalid headcount. Must be between 1 and 5000.',
    });
  });
});