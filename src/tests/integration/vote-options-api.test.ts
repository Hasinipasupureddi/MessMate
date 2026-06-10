/** @jest-environment node */

import { GET } from '@/app/api/vote-options/route';

describe('Vote options API', () => {
  it('returns vote options for a valid date', async () => {
    const request = new Request('http://localhost/api/vote-options?date=2026-06-05');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty('options');
    expect(Array.isArray(body.options)).toBe(true);
  });
});
