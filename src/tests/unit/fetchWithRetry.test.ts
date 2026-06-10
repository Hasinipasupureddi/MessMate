import { fetchWithRetry } from '@/lib/utils/fetchWithRetry';

describe('fetchWithRetry', () => {
  it('retries once when the first request fails with a network error', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response);

    const response = await fetchWithRetry(
      '/api/meal-votes',
      { method: 'POST', body: JSON.stringify({ votes: [] }) },
      { retries: 1, backoffMs: 0 },
      fetchMock as unknown as typeof fetch,
    );

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
