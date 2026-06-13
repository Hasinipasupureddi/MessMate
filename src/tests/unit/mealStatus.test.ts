import { formatIstDateLabel } from '@/lib/utils/mealStatus';

describe('IST date formatting', () => {
  it('uses Asia/Kolkata time zone for student dashboard labels', () => {
    const date = new Date('2026-06-12T23:30:00.000Z');

    expect(formatIstDateLabel(date)).toBe('Saturday, 13 Jun');
  });
});
