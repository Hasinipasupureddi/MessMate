/** @jest-environment node */

import { GET, PATCH } from '@/app/api/warden/final-menu/route';
import { getVotes } from '@/lib/api/mealVotesMySQL';
import {
  getFinalMenuRows,
  hydrateFinalMenuDay,
  saveFinalMenu,
  saveMenuRotation,
  generateAndSaveFinalMenu,
} from '@/lib/api/finalMenuMySQL';
import { getLatestWardenMenuFeedback, saveWardenMenuFeedback } from '@/lib/api/menuFeedbackMySQL';
import { requireRole } from '@/lib/auth/guards';
import { createGlobalNotification } from '@/lib/api/notificationsMySQL';
import { emitRealtimeEvent } from '@/lib/socket/bridge';

jest.mock('@/lib/api/mealVotesMySQL', () => ({
  getVotes: jest.fn(),
}));

jest.mock('@/lib/api/finalMenuMySQL', () => ({
  getFinalMenuRows: jest.fn(),
  hydrateFinalMenuDay: jest.fn(),
  saveFinalMenu: jest.fn(),
  saveMenuRotation: jest.fn(),
  generateAndSaveFinalMenu: jest.fn(),
}));

jest.mock('@/lib/auth/guards', () => ({
  requireRole: jest.fn(),
}));

jest.mock('@/lib/api/notificationsMySQL', () => ({
  createGlobalNotification: jest.fn(),
}));

jest.mock('@/lib/api/menuFeedbackMySQL', () => ({
  getLatestWardenMenuFeedback: jest.fn(),
  saveWardenMenuFeedback: jest.fn(),
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
const mockedGetFinalMenuRows = jest.mocked(getFinalMenuRows);
const mockedHydrateFinalMenuDay = jest.mocked(hydrateFinalMenuDay);
const mockedSaveFinalMenu = jest.mocked(saveFinalMenu);
const mockedSaveMenuRotation = jest.mocked(saveMenuRotation);
const mockedGenerateAndSaveFinalMenu = jest.mocked(generateAndSaveFinalMenu);
const mockedCreateGlobalNotification = jest.mocked(createGlobalNotification);
const mockedEmitRealtimeEvent = jest.mocked(emitRealtimeEvent);
const mockedGetLatestWardenMenuFeedback = jest.mocked(getLatestWardenMenuFeedback);
const mockedSaveWardenMenuFeedback = jest.mocked(saveWardenMenuFeedback);

describe('Warden final menu approval API', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedRequireRole.mockResolvedValue({
      ok: true,
      session: {
        sub: 'demo-warden-1',
        role: 'warden',
        email: 'warden@example.com',
        name: 'Demo Warden',
        hostelId: 'A',
      },
    });
  });

  it('approves an awaiting approval menu and notifies students', async () => {
    mockedGetFinalMenuRows.mockResolvedValue([
      {
        menuDate: '2026-06-06',
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

    mockedHydrateFinalMenuDay.mockReturnValue({
      dateKey: '2026-06-06',
      status: 'awaiting_approval',
      meals: [
        {
          mealType: 'breakfast',
          title: 'Breakfast',
          subtitle: 'Breakfast preview',
          fixedItems: ['Tea'],
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
          fallbackOptionIds: ['B02'],
          winnerSource: 'staff_override',
          overrideReason: 'Manual override',
        },
      ],
    } as any);

    const request = new Request('http://localhost/api/warden/final-menu?date=2026-06-06', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });

    const response = await PATCH(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedGetFinalMenuRows).toHaveBeenCalledWith('2026-06-06');
    expect(mockedHydrateFinalMenuDay).toHaveBeenCalledWith('2026-06-06', expect.any(Array));
    expect(mockedSaveFinalMenu).toHaveBeenCalledWith(expect.objectContaining({
      meals: [expect.any(Object)],
    }), 'approved');
    expect(mockedSaveMenuRotation).toHaveBeenCalled();
    expect(mockedCreateGlobalNotification).toHaveBeenCalled();
    expect(mockedEmitRealtimeEvent).toHaveBeenCalledTimes(2);
    expect(body).toEqual({ success: true, message: 'Menu approved.', menu: expect.any(Object) });
  });

  it('returns pending menu details and latest feedback via GET', async () => {
    mockedGetFinalMenuRows.mockResolvedValue([]);
    mockedGetLatestWardenMenuFeedback.mockResolvedValue({
      comment: 'Please replace one item with idli.',
      created_at: '2026-06-05T12:00:00.000Z',
    } as any);

    const request = new Request('http://localhost/api/warden/final-menu?date=2026-06-06', {
      method: 'GET',
    });

    const response = await GET(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedGetFinalMenuRows).toHaveBeenCalledWith('2026-06-06');
    expect(mockedGetLatestWardenMenuFeedback).toHaveBeenCalledWith('2026-06-06');
    expect(body).toEqual({
      menu: expect.any(Object),
      feedback: {
        comment: 'Please replace one item with idli.',
        created_at: '2026-06-05T12:00:00.000Z',
      },
    });
  });

  it('saves a request_changes feedback and returns updated menu state', async () => {
    mockedGetFinalMenuRows.mockResolvedValue([{
      menuDate: '2026-06-06',
      mealType: 'breakfast',
      categoryKey: 'main',
      winningItemId: 'B02',
      winningItemName: 'Pesarattu + Ginger Chutney',
      winningItemsJson: JSON.stringify([{
        label: 'Pesarattu + Ginger Chutney',
        emoji: '🟢',
        items: ['Pesarattu', 'Ginger Chutney'],
        selectedOptionId: 'B02',
        votes: 1,
        dietPreference: 'both',
      }]),
      status: 'awaiting_approval',
      winnerSource: 'staff_override',
      overrideReason: 'Manual override',
      generatedAt: '2026-06-05T00:00:00.000Z',
    }] as any);

    mockedHydrateFinalMenuDay.mockReturnValue({
      dateKey: '2026-06-06',
      status: 'awaiting_approval',
      meals: [{
        mealType: 'breakfast',
        title: 'Breakfast',
        subtitle: 'Breakfast preview',
        fixedItems: ['Tea'],
        winningItems: [{
          label: 'Pesarattu + Ginger Chutney',
          emoji: '🟢',
          items: ['Pesarattu', 'Ginger Chutney'],
          selectedOptionId: 'B02',
          votes: 1,
          dietPreference: 'both',
        }],
        fallbackOptionIds: ['B02'],
        winnerSource: 'staff_override',
        overrideReason: 'Manual override',
      }],
    } as any);

    mockedSaveWardenMenuFeedback.mockResolvedValue({
      id: 'menu-feedback-demo',
      menu_date: '2026-06-06',
      meal_type: null,
      warden_id: 'demo-warden-1',
      action: 'request_changes',
      comment: 'Please reduce spice levels.',
      created_at: '2026-06-05T12:00:00.000Z',
    });

    const request = new Request('http://localhost/api/warden/final-menu?date=2026-06-06', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'request_changes', comment: 'Please reduce spice levels.' }),
    });

    const response = await PATCH(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedSaveWardenMenuFeedback).toHaveBeenCalledWith({
      menuDate: '2026-06-06',
      mealType: null,
      wardenId: 'demo-warden-1',
      action: 'request_changes',
      comment: 'Please reduce spice levels.',
    });
    expect(mockedEmitRealtimeEvent).toHaveBeenCalledTimes(2);
    expect(body).toEqual({
      success: true,
      message: 'Menu feedback saved. Staff can revise the draft and resubmit when ready.',
      feedback: {
        id: 'menu-feedback-demo',
        menu_date: '2026-06-06',
        meal_type: null,
        warden_id: 'demo-warden-1',
        action: 'request_changes',
        comment: 'Please reduce spice levels.',
        created_at: '2026-06-05T12:00:00.000Z',
      },
    });
  });
});
