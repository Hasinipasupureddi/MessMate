/** @jest-environment node */

import { POST } from '@/app/api/live/finalize-menu/route';
import { getVotes } from '@/lib/api/mealVotesMySQL';
import { generateAndSaveFinalMenu, getFinalMenuRows, hydrateFinalMenuDay, saveFinalMenu, saveMenuRotation } from '@/lib/api/finalMenuMySQL';
import { requireRole } from '@/lib/auth/guards';
import { createGlobalNotification } from '@/lib/api/notificationsMySQL';
import { emitRealtimeEvent } from '@/lib/socket/bridge';
import { getIstDateString } from '@/lib/utils/mealStatus';

jest.mock('@/lib/api/mealVotesMySQL', () => ({
  getVotes: jest.fn(),
}));

jest.mock('@/lib/api/finalMenuMySQL', () => ({
  generateAndSaveFinalMenu: jest.fn(),
  getFinalMenuRows: jest.fn(),
  hydrateFinalMenuDay: jest.fn(),
  saveFinalMenu: jest.fn(),
  saveMenuRotation: jest.fn(),
}));

jest.mock('@/lib/auth/guards', () => ({
  requireRole: jest.fn(),
}));

jest.mock('@/lib/api/notificationsMySQL', () => ({
  createGlobalNotification: jest.fn(),
}));

jest.mock('@/lib/socket/bridge', () => ({
  emitRealtimeEvent: jest.fn(),
  SOCKET_EVENTS: {
    dashboardRefresh: 'dashboardRefresh',
    notificationsUpdated: 'notificationsUpdated',
  },
}));

const mockedRequireRole = jest.mocked(requireRole);
const mockedGetVotes = jest.mocked(getVotes);
const mockedGenerateAndSaveFinalMenu = jest.mocked(generateAndSaveFinalMenu);
const mockedGetFinalMenuRows = jest.mocked(getFinalMenuRows);
const mockedHydrateFinalMenuDay = jest.mocked(hydrateFinalMenuDay);
const mockedSaveFinalMenu = jest.mocked(saveFinalMenu);
const mockedSaveMenuRotation = jest.mocked(saveMenuRotation);
const mockedCreateGlobalNotification = jest.mocked(createGlobalNotification);
const mockedEmitRealtimeEvent = jest.mocked(emitRealtimeEvent);

describe('Finalize menu API', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedRequireRole.mockResolvedValue({
      ok: true,
      session: {
        sub: 'demo-staff-1',
        role: 'staff',
        email: 'staff@example.com',
        name: 'Demo Staff',
        hostelId: 'H1',
      },
    });
  });

  it('approves current vote winners and preserves explicit staff override meals', async () => {
    mockedGetVotes.mockResolvedValue({
      rows: [
        { mealType: 'breakfast', categoryKey: 'main', menuOption: 'B04', option: 'Poori + Kurma', votes: 4 },
      ],
      totalStudents: 7,
      totalUniqueVoters: 5,
      participation: { breakfast: 5 },
    } as any);

    mockedGetFinalMenuRows.mockResolvedValue([
      {
        mealType: 'breakfast',
        categoryKey: 'main',
        winningItemId: 'B02',
        winningItemName: 'Pesarattu + Ginger Chutney',
        winningItemsJson: JSON.stringify([
          {
            label: 'Pesarattu + Ginger Chutney',
            emoji: '🟢',
            items: ['Pesarattu', 'Ginger Chutney'],
            selectedOptionId: 'B02',
            votes: 1,
            dietPreference: 'both',
          },
        ]),
        status: 'awaiting_approval',
        winnerSource: 'staff_override',
        overrideReason: 'Manual override',
        generatedAt: '2026-06-05T00:00:00.000Z',
      },
    ] as any);

    const generatedMenu = {
      dateKey: '2026-06-06',
      dayName: 'Friday',
      dayShort: 'Fri',
      status: 'awaiting_approval',
      meals: [
        {
          mealType: 'breakfast',
          title: 'Breakfast',
          subtitle: 'Tea and milk stay fixed; students choose the main dish',
          fixedItems: ['Tea', 'Milk'],
          winningItems: [
            {
              label: 'Poori + Kurma',
              emoji: '🫓',
              items: ['Poori', 'Kurma'],
              selectedOptionId: 'B04',
              votes: 4,
              dietPreference: 'both',
            },
          ],
          fallbackOptionIds: ['B04', 'B02', 'B08'],
          winnerSource: 'votes',
          overrideReason: null,
        },
      ],
    } as any;

    mockedGenerateAndSaveFinalMenu.mockResolvedValue(generatedMenu);
    mockedHydrateFinalMenuDay.mockReturnValue({
      ...generatedMenu,
      meals: [
        {
          ...generatedMenu.meals[0],
          winningItems: [
            {
              label: 'Pesarattu + Ginger Chutney',
              emoji: '🟢',
              items: ['Pesarattu', 'Ginger Chutney'],
              selectedOptionId: 'B02',
              votes: 1,
              dietPreference: 'both',
            },
          ],
          winnerSource: 'staff_override',
          overrideReason: 'Manual override',
        },
      ],
    } as any);

    const request = new Request('http://localhost/api/live/finalize-menu', { method: 'POST' });
    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    const tomorrow = getIstDateString(1);
    expect(mockedGetVotes).toHaveBeenCalledWith(tomorrow);
    expect(mockedGenerateAndSaveFinalMenu).toHaveBeenCalledWith(tomorrow, expect.any(Array), 'awaiting_approval');
    expect(mockedSaveFinalMenu).toHaveBeenCalledWith(expect.objectContaining({
      meals: [
        expect.objectContaining({
          mealType: 'breakfast',
          winnerSource: 'staff_override',
          winningItems: [
            expect.objectContaining({
              selectedOptionId: 'B02',
            }),
          ],
        }),
      ],
    }), 'awaiting_approval');
    expect(mockedSaveMenuRotation).not.toHaveBeenCalled();
    expect(mockedCreateGlobalNotification).not.toHaveBeenCalled();
    expect(mockedEmitRealtimeEvent).not.toHaveBeenCalled();
    expect(body).toEqual({ success: true, menu: expect.any(Object) });
  });
});
