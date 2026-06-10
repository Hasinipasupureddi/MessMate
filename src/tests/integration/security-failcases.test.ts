/** @jest-environment node */

import { POST as postCooking } from '@/app/api/cooking-tasks/route';
import { GET as getWardenKpis } from '@/app/api/warden/kpis/route';
import { PUT as putMealRatings } from '@/app/api/meal-ratings/route';
import { POST as postClaim } from '@/app/api/leftover-claims/route';
import { NextResponse } from 'next/server';

jest.mock('@/lib/auth/guards', () => ({
  requireRole: jest.fn(),
}));

jest.mock('@/lib/api/leftoversMySQL', () => ({
  claimLeftover: jest.fn(),
  listLeftovers: jest.fn(),
}));

import { requireRole } from '@/lib/auth/guards';
import { claimLeftover } from '@/lib/api/leftoversMySQL';

const mockedRequireRole = jest.mocked(requireRole as any);
const mockedClaimLeftover = jest.mocked(claimLeftover as any);

describe('Security and fail-case coverage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('blocks cooking-tasks POST for non-staff', async () => {
    mockedRequireRole.mockResolvedValue({ ok: false, response: NextResponse.json({ message: 'Forbidden' }, { status: 403 }) });

    const req = new Request('http://localhost/api/cooking-tasks', { method: 'POST', body: JSON.stringify({}) });
    const res = await postCooking(req as any);
    expect(res.status).toBe(403);
  });

  it('blocks warden kpis GET for non-warden', async () => {
    mockedRequireRole.mockResolvedValue({ ok: false, response: NextResponse.json({ message: 'Forbidden' }, { status: 403 }) });

    const req = new Request('http://localhost/api/warden/kpis');
    const res = await getWardenKpis(req as any);
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid meal rating payload', async () => {
    mockedRequireRole.mockResolvedValue({ ok: true, session: { sub: 'demo-student-1' } });

    const req = new Request('http://localhost/api/meal-ratings', { method: 'PUT', body: JSON.stringify({}) });
    const res = await putMealRatings(req as any);
    expect(res.status).toBe(400);
  });

  it('handles concurrent leftover claims (one success, one fail)', async () => {
    mockedRequireRole.mockResolvedValue({ ok: true, session: { sub: 'demo-student-1' } });

    mockedClaimLeftover.mockResolvedValueOnce({ success: true, message: 'Claim successful.' });
    mockedClaimLeftover.mockResolvedValueOnce({ success: false, message: 'No portions left.' });

    const req1 = new Request('http://localhost/api/leftover-claims', { method: 'POST', body: JSON.stringify({ leftoverId: 'leftover-1' }) });
    const req2 = new Request('http://localhost/api/leftover-claims', { method: 'POST', body: JSON.stringify({ leftoverId: 'leftover-1' }) });

    const res1 = await postClaim(req1 as any);
    const body1 = await res1.json();
    expect(res1.status).toBe(200);
    expect(body1).toEqual({ success: true, message: 'Claim successful.' });

    const res2 = await postClaim(req2 as any);
    const body2 = await res2.json();
    expect(res2.status).toBe(409);
    expect(body2).toEqual({ success: false, message: 'No portions left.' });
  });
});
