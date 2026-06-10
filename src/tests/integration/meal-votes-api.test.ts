/** @jest-environment node */

import { GET, POST } from '@/app/api/meal-votes/route';
import * as mealStatus from '@/lib/utils/mealStatus';
import { getVotes, saveVotes } from '@/lib/api/mealVotesMySQL';
import { requireAuth, requireRole } from '@/lib/auth/guards';

jest.mock('@/lib/utils/mealStatus', () => ({
  getIstDateString: jest.fn(() => '2026-05-22'),
  getIstNow: jest.fn(() => new Date('2026-05-22T20:00:00.000Z')),
}));

jest.mock('@/lib/api/mealVotesMySQL', () => ({
  getVotes: jest.fn(),
  saveVotes: jest.fn(),
}));

jest.mock('@/lib/socket/bridge', () => ({
  emitRealtimeEvent: jest.fn(),
  SOCKET_EVENTS: {
    mealVotesSubmitted: 'meal-votes:submitted',
    notificationsUpdated: 'notifications:updated',
    analyticsRefresh: 'analytics:refresh',
  },
}));

jest.mock('@/lib/auth/guards', () => ({
  requireAuth: jest.fn(),
  requireRole: jest.fn(),
}));

const mockedRequireAuth = jest.mocked(requireAuth);
const mockedRequireRole = jest.mocked(requireRole);

describe('Meal votes API coverage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(mealStatus.getIstNow).mockReturnValue(new Date('2026-05-22T20:00:00.000Z'));
    mockedRequireAuth.mockResolvedValue({
      ok: true,
      session: {
        sub: 'demo-student-1',
        role: 'student',
        hostelId: 'A',
        emailVerified: true,
        email: 'test@example.com',
        name: 'Test Student',
        foodPreference: 'veg',
      },
    });
    mockedRequireRole.mockResolvedValue({
      ok: true,
      session: {
        sub: 'demo-student-1',
        role: 'student',
        hostelId: 'A',
        emailVerified: true,
        email: 'test@example.com',
        name: 'Test Student',
        foodPreference: 'veg',
      },
    });
  });

  it('returns aggregated vote rows for a date', async () => {
    jest.mocked(getVotes).mockResolvedValue({
      rows: [
        { mealType: 'breakfast', menuOption: 'vote-dosa', option: 'Masala Dosa', votes: 12, categoryKey: 'main', votedAt: null },
        { mealType: 'lunch', menuOption: 'vote-paneer', option: 'Paneer Butter Masala', votes: 9, categoryKey: 'main', votedAt: null },
      ],
      totalStudents: 100,
      totalUniqueVoters: 21,
      participation: { breakfast: 12, lunch: 9 }
    } as any);

    const request = new Request('http://localhost/api/meal-votes?date=2026-05-22');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getVotes).toHaveBeenCalledWith('2026-05-22', undefined);
    expect(body).toEqual({
      rows: [
        { mealType: 'breakfast', menuOption: 'vote-dosa', option: 'Masala Dosa', votes: 12, categoryKey: 'main', votedAt: null },
        { mealType: 'lunch', menuOption: 'vote-paneer', option: 'Paneer Butter Masala', votes: 9, categoryKey: 'main', votedAt: null },
      ],
      totalStudents: 100,
      totalUniqueVoters: 21,
      participation: { breakfast: 12, lunch: 9 }
    });
  });

  it('accepts vote submissions via POST', async () => {
    const request = new Request('http://localhost/api/meal-votes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        votes: [
          {
            student_id: 'demo-student-1',
            meal_date: '2026-05-22',
            meal_type: 'breakfast',
            menu_option: 'vote-dosa',
            dish_name: 'Masala Dosa',
          },
        ],
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(saveVotes).toHaveBeenCalledWith(
      'demo-student-1',
      '2026-05-22',
      [
        {
          student_id: 'demo-student-1',
          studentId: 'demo-student-1',
          meal_date: '2026-05-22',
          meal_type: 'breakfast',
          menu_option: 'vote-dosa',
          dish_name: 'Masala Dosa',
        },
      ],
      undefined
    );
    expect(body).toEqual({ success: true });
  });

  it('rejects vote submissions after 10 PM IST', async () => {
    jest.mocked(mealStatus.getIstNow).mockReturnValue(new Date('2026-05-22T22:30:00.000Z'));

    const request = new Request('http://localhost/api/meal-votes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        votes: [
          {
            student_id: 'demo-student-1',
            meal_date: '2026-05-22',
            meal_type: 'breakfast',
            menu_option: 'vote-dosa',
            dish_name: 'Masala Dosa',
          },
        ],
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ message: 'Voting for tomorrow\'s menu is closed. No new votes are accepted after 10:00 PM IST.' });
    expect(saveVotes).not.toHaveBeenCalled();
  });
});
