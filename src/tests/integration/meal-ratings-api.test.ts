/** @jest-environment node */

import { GET, PUT } from '@/app/api/meal-ratings/route';
import { getRatings, saveRating } from '@/lib/api/mealRatingsMySQL';
import { requireRole } from '@/lib/auth/guards';

jest.mock('@/lib/api/mealRatingsMySQL', () => {
  const actual = jest.requireActual('@/lib/api/mealRatingsMySQL');
  return {
    ...actual,
    getRatings: jest.fn(),
    saveRating: jest.fn(),
  };
});

jest.mock('@/lib/auth/guards', () => ({
  requireRole: jest.fn(),
}));

describe('Meal ratings API smoke coverage', () => {
  const mockedGetRatings = jest.mocked(getRatings);
  const mockedSaveRating = jest.mocked(saveRating);
  const mockedRequireRole = jest.mocked(requireRole);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns saved ratings for the signed-in student', async () => {
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
    mockedGetRatings.mockResolvedValue([
      { meal_type: 'breakfast', rating: 5, waste_amount: 'none' },
    ]);

    const response = await GET(new Request('http://localhost/api/meal-ratings?date=2026-05-14&studentId=demo-student-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      rows: [{ meal_type: 'breakfast', rating: 5, waste_amount: 'none' }],
    });
  });

  it('persists a rating through the MySQL layer', async () => {
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
    mockedSaveRating.mockResolvedValue(undefined);

    const request = new Request('http://localhost/api/meal-ratings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ratingDate: '2026-05-14',
        mealType: 'breakfast',
        dishName: 'Idly + Sambar',
        rating: 5,
        wasteAmount: 'none',
      }),
    });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedSaveRating).toHaveBeenCalledWith({
      studentId: 'demo-student-1',
      ratingDate: '2026-05-14',
      mealType: 'breakfast',
      dishName: 'Idli + Sambar',
      rating: 5,
      wasteAmount: 'none',
    });
    expect(body).toEqual({ success: true });
  });
});