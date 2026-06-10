/** @jest-environment node */

import { GET } from '@/app/api/live/final-menu/route';
import { getVotes } from '@/lib/api/mealVotesMySQL';
import { buildFinalMenuFromVotes, getFinalMenuRows, hydrateFinalMenuDay, getTotalStudentCount } from '@/lib/api/finalMenuMySQL';
import { normalizeDietPreference } from '@/lib/menu/masterMenu';
import { getOptionById } from '@/lib/api/voteOptionsMySQL';
import { WEDNESDAY_SPECIAL_OPTIONS } from '@/lib/menu/sundayCatalog';

jest.mock('@/lib/api/mealVotesMySQL', () => ({
  getVotes: jest.fn(),
}));

jest.mock('@/lib/api/finalMenuMySQL', () => ({
  buildFinalMenuFromVotes: jest.fn(),
  getFinalMenuRows: jest.fn(),
  hydrateFinalMenuDay: jest.fn(),
  getTotalStudentCount: jest.fn(),
}));

const mockedGetVotes = jest.mocked(getVotes);
const mockedGetFinalMenuRows = jest.mocked(getFinalMenuRows);
const mockedHydrateFinalMenuDay = jest.mocked(hydrateFinalMenuDay);
const mockedBuildFinalMenuFromVotes = jest.mocked(buildFinalMenuFromVotes);
const mockedGetTotalStudentCount = jest.mocked(getTotalStudentCount);

describe('Live final menu route', () => {
  it('includes explicit veg and non-veg Wednesday special items for the dashboard', () => {
    const labels = WEDNESDAY_SPECIAL_OPTIONS.map((option) => option.label);

    expect(labels).toContain('Veg Special Item');
    expect(labels).toContain('Non-Veg Special Item');
  });

  it('finds Wednesday special items by ID for saved menu hydration', () => {
    const option = getOptionById('wed-s-nv1');

    expect(option).toBeDefined();
    expect(option?.label).toBe('Masala Egg');
    expect(option?.dietPreference).toBe('non_veg');
    expect(option?.category).toBe('side');
  });

  it('normalizes hyphenated non-veg preferences correctly', () => {
    expect(normalizeDietPreference('non-veg')).toBe('non_veg');
    expect(normalizeDietPreference('Non-Veg')).toBe('non_veg');
    expect(normalizeDietPreference('non_veg')).toBe('non_veg');
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockedGetTotalStudentCount.mockResolvedValue(7);
  });

  it('builds live vote preview when saved menu is pending and not staff overridden', async () => {
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
            votes: 0,
            dietPreference: 'both',
          },
        ]),
        status: 'awaiting_approval',
        winnerSource: 'votes',
        overrideReason: null,
        generatedAt: '2026-06-05T00:00:00.000Z',
      },
    ] as any);

    mockedHydrateFinalMenuDay.mockReturnValue({
      dateKey: '2026-06-06',
      meals: [
        {
          mealType: 'breakfast',
          winningItems: [
            {
              label: 'Pesarattu + Ginger Chutney',
              emoji: '🟢',
              items: ['Pesarattu', 'Ginger Chutney'],
              selectedOptionId: 'B02',
              votes: 0,
              dietPreference: 'both',
            },
          ],
          winnerSource: 'votes',
          overrideReason: null,
          title: 'Breakfast',
          subtitle: '',
          fixedItems: [],
          fallbackOptionIds: [],
        },
      ],
      status: 'awaiting_approval',
      dayName: 'Friday',
      dayShort: 'Fri',
    } as any);

    mockedGetVotes.mockResolvedValue({
      rows: [
        {
          mealType: 'breakfast',
          categoryKey: 'main',
          menuOption: 'B04',
          option: 'Poori + Kurma',
          votes: 4,
        },
      ],
      totalStudents: 7,
      totalUniqueVoters: 4,
      participation: { breakfast: 4 },
    } as any);

    mockedBuildFinalMenuFromVotes.mockResolvedValue({
      dateKey: '2026-06-06',
      dayName: 'Friday',
      dayShort: 'Fri',
      status: 'awaiting_approval',
      meals: [
        {
          mealType: 'breakfast',
          title: 'Breakfast',
          subtitle: '',
          fixedItems: [],
          winningItems: [
            {
              label: 'Poori + Kurma',
              emoji: '🫓',
              items: ['Poori', 'Potato Kurma'],
              selectedOptionId: 'B04',
              votes: 4,
              dietPreference: 'both',
            },
          ],
          fallbackOptionIds: [],
          winnerSource: 'votes',
          overrideReason: null,
        },
      ],
    } as any);

    const response = await GET(new Request('http://localhost/api/live/final-menu?date=2026-06-06') as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.generated).toBe(true);
    expect(body.menu.meals[0].winningItems[0].selectedOptionId).toBe('B04');
    expect(body.menu.meals[0].winningItems[0].label).toBe('Poori + Kurma');
  });

  it('keeps the standard lunch items visible for non-veg users instead of filtering everything out', async () => {
    mockedGetFinalMenuRows.mockResolvedValue([]);

    mockedGetVotes.mockResolvedValue({
      rows: [],
      totalStudents: 7,
      totalUniqueVoters: 0,
      participation: {},
    } as any);

    mockedBuildFinalMenuFromVotes.mockResolvedValue({
      dateKey: '2026-06-10',
      dayName: 'Wednesday',
      dayShort: 'Wed',
      status: 'awaiting_approval',
      meals: [
        {
          mealType: 'lunch',
          title: 'Lunch',
          subtitle: '',
          fixedItems: ['Rice', 'Curd'],
          winningItems: [
            {
              label: 'Veg Curry',
              emoji: '🥗',
              items: ['Veg Curry'],
              selectedOptionId: 'L01',
              votes: 5,
              dietPreference: 'veg',
            },
            {
              label: 'Egg Roast',
              emoji: '🥚',
              items: ['Egg Roast'],
              selectedOptionId: 'wed-s-nv2',
              votes: 2,
              dietPreference: 'non_veg',
            },
          ],
          fallbackOptionIds: [],
          winnerSource: 'votes',
          overrideReason: null,
        },
      ],
    } as any);

    const response = await GET(new Request('http://localhost/api/live/final-menu?date=2026-06-10&pref=non_veg') as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.menu.meals[0].winningItems).toHaveLength(2);
  });

  it('keeps non-veg items visible when no preference is passed to the live menu API', async () => {
    mockedGetFinalMenuRows.mockResolvedValue([]);

    mockedGetVotes.mockResolvedValue({
      rows: [],
      totalStudents: 7,
      totalUniqueVoters: 0,
      participation: {},
    } as any);

    mockedBuildFinalMenuFromVotes.mockResolvedValue({
      dateKey: '2026-06-10',
      dayName: 'Wednesday',
      dayShort: 'Wed',
      status: 'awaiting_approval',
      meals: [
        {
          mealType: 'lunch',
          title: 'Lunch',
          subtitle: '',
          fixedItems: ['Rice', 'Curd'],
          winningItems: [
            {
              label: 'Masala Egg',
              emoji: '🥚',
              items: ['Masala Egg'],
              selectedOptionId: 'wed-s-nv1',
              votes: 5,
              dietPreference: 'non_veg',
            },
          ],
          fallbackOptionIds: [],
          winnerSource: 'votes',
          overrideReason: null,
        },
      ],
    } as any);

    const response = await GET(new Request('http://localhost/api/live/final-menu?date=2026-06-10') as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.menu.meals[0].winningItems).toHaveLength(1);
    expect(body.menu.meals[0].winningItems[0].label).toBe('Masala Egg');
  });

  it('preserves explicit staff override when saved menu is pending', async () => {
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
            votes: 0,
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
      meals: [
        {
          mealType: 'breakfast',
          winningItems: [
            {
              label: 'Pesarattu + Ginger Chutney',
              emoji: '🟢',
              items: ['Pesarattu', 'Ginger Chutney'],
              selectedOptionId: 'B02',
              votes: 0,
              dietPreference: 'both',
            },
          ],
          winnerSource: 'staff_override',
          overrideReason: 'Manual override',
          title: 'Breakfast',
          subtitle: '',
          fixedItems: [],
          fallbackOptionIds: [],
        },
      ],
      status: 'awaiting_approval',
      dayName: 'Friday',
      dayShort: 'Fri',
    } as any);

    mockedGetVotes.mockResolvedValue({
      rows: [
        {
          mealType: 'breakfast',
          categoryKey: 'main',
          menuOption: 'B04',
          option: 'Poori + Kurma',
          votes: 4,
        },
      ],
      totalStudents: 7,
      totalUniqueVoters: 4,
      participation: { breakfast: 4 },
    } as any);

    mockedBuildFinalMenuFromVotes.mockResolvedValue({
      dateKey: '2026-06-06',
      dayName: 'Friday',
      dayShort: 'Fri',
      status: 'awaiting_approval',
      meals: [
        {
          mealType: 'breakfast',
          title: 'Breakfast',
          subtitle: '',
          fixedItems: [],
          winningItems: [
            {
              label: 'Poori + Kurma',
              emoji: '🫓',
              items: ['Poori', 'Potato Kurma'],
              selectedOptionId: 'B04',
              votes: 4,
              dietPreference: 'both',
            },
          ],
          fallbackOptionIds: [],
          winnerSource: 'votes',
          overrideReason: null,
        },
      ],
    } as any);

    const response = await GET(new Request('http://localhost/api/live/final-menu?date=2026-06-06') as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.generated).toBe(true);
    expect(body.menu.meals[0].winnerSource).toBe('staff_override');
    expect(body.menu.meals[0].winningItems[0].selectedOptionId).toBe('B02');
    expect(body.menu.meals[0].winningItems[0].label).toBe('Pesarattu + Ginger Chutney');
  });
});
