/** @jest-environment node */

jest.mock('@/lib/db/init', () => ({
  ensureMysqlSchema: jest.fn(),
}));

jest.mock('@/lib/db/mysql', () => ({
  getMysqlPool: jest.fn(),
}));

jest.mock('@/lib/menu/votingBlueprints', () => {
  const actual = jest.requireActual('@/lib/menu/votingBlueprints');
  return {
    ...actual,
    getVoteBlueprintsForDate: jest.fn(),
  };
});

import { getVoteOptionsForDate } from '@/lib/api/voteOptionsMySQL';
import { getMysqlPool } from '@/lib/db/mysql';
import { getVoteBlueprintsForDate } from '@/lib/menu/votingBlueprints';

const mockedGetMysqlPool = jest.mocked(getMysqlPool);
const mockedGetVoteBlueprintsForDate = jest.mocked(getVoteBlueprintsForDate);

describe('vote options generation', () => {
  it('filters recently served items by their generated option IDs', async () => {
    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
      execute: jest.fn(async () => [[]]),
    };

    const executeMock = jest.fn(async (sql: string) => {
      if (sql.includes('FROM vote_options')) {
        return [[]];
      }
      if (sql.includes('FROM menu_rotation')) {
        return [[]];
      }
      if (sql.includes('FROM final_menu')) {
        return [[
          { winning_item_id: 'b1-2026-06-10-main', menu_date: '2026-06-10' },
        ]];
      }
      if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) {
        return [[{ cnt: 0 }]];
      }
      return [[]];
    });

    mockedGetMysqlPool.mockReturnValue({
      execute: executeMock,
      getConnection: jest.fn().mockResolvedValue(connection),
    } as any);

    mockedGetVoteBlueprintsForDate.mockReturnValue([
      {
        mealType: 'breakfast',
        key: 'breakfast',
        title: 'Breakfast',
        subtitle: 'Breakfast',
        fixedItems: [],
        categories: [{ id: 'main', label: 'Main', type: 'main' }],
        options: [
          { id: 'b1', label: 'A', emoji: '🥞', items: ['A'], category: 'main', dietPreference: 'both' },
          { id: 'b2', label: 'B', emoji: '🥞', items: ['B'], category: 'main', dietPreference: 'both' },
          { id: 'b3', label: 'C', emoji: '🥞', items: ['C'], category: 'main', dietPreference: 'both' },
          { id: 'b4', label: 'D', emoji: '🥞', items: ['D'], category: 'main', dietPreference: 'both' },
        ],
      },
    ] as any);

    const result = await getVoteOptionsForDate('2026-06-11', false, 'breakfast');

    expect(result.some((item: any) => item.id === 'b1-2026-06-11-main')).toBe(false);
  });

  it('does not rely on original_catalog_id when the schema is older', async () => {
    const insertQueries: string[] = [];

    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
      execute: jest.fn(async (sql: string) => {
        insertQueries.push(sql);
        return [[{}]];
      }),
    };

    const executeMock = jest.fn(async (sql: string) => {
      if (sql.includes('FROM vote_options WHERE vote_date = ?')) {
        return [[]];
      }
      if (sql.includes('FROM menu_rotation')) {
        return [[]];
      }
      if (sql.includes('FROM final_menu')) {
        return [[]];
      }
      if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) {
        return [[{ cnt: 0 }]];
      }
      return [[{}]];
    });

    mockedGetMysqlPool.mockReturnValue({
      execute: executeMock,
      getConnection: jest.fn().mockResolvedValue(connection),
    } as any);

    mockedGetVoteBlueprintsForDate.mockReturnValue([
      {
        mealType: 'breakfast',
        key: 'breakfast',
        title: 'Breakfast',
        subtitle: 'Breakfast',
        fixedItems: [],
        categories: [{ id: 'main', label: 'Main', type: 'main' }],
        options: [
          { id: 'b1', label: 'A', emoji: '🥞', items: ['A'], category: 'main', dietPreference: 'both' },
          { id: 'b2', label: 'B', emoji: '🥞', items: ['B'], category: 'main', dietPreference: 'both' },
          { id: 'b3', label: 'C', emoji: '🥞', items: ['C'], category: 'main', dietPreference: 'both' },
        ],
      },
      {
        mealType: 'lunch',
        key: 'lunch',
        title: 'Lunch',
        subtitle: 'Lunch',
        fixedItems: [],
        categories: [{ id: 'main', label: 'Main', type: 'main' }],
        options: [
          { id: 'l1', label: 'L1', emoji: '🍛', items: ['L1'], category: 'main', dietPreference: 'both' },
          { id: 'l2', label: 'L2', emoji: '🍛', items: ['L2'], category: 'main', dietPreference: 'both' },
          { id: 'l3', label: 'L3', emoji: '🍛', items: ['L3'], category: 'main', dietPreference: 'both' },
        ],
      },
      {
        mealType: 'snack',
        key: 'snack',
        title: 'Snack',
        subtitle: 'Snack',
        fixedItems: [],
        categories: [{ id: 'main', label: 'Main', type: 'main' }],
        options: [
          { id: 's1', label: 'S1', emoji: '🍪', items: ['S1'], category: 'main', dietPreference: 'both' },
          { id: 's2', label: 'S2', emoji: '🍪', items: ['S2'], category: 'main', dietPreference: 'both' },
          { id: 's3', label: 'S3', emoji: '🍪', items: ['S3'], category: 'main', dietPreference: 'both' },
        ],
      },
      {
        mealType: 'dinner',
        key: 'dinner',
        title: 'Dinner',
        subtitle: 'Dinner',
        fixedItems: [],
        categories: [{ id: 'main', label: 'Main', type: 'main' }],
        options: [
          { id: 'd1', label: 'D1', emoji: '🍲', items: ['D1'], category: 'main', dietPreference: 'both' },
          { id: 'd2', label: 'D2', emoji: '🍲', items: ['D2'], category: 'main', dietPreference: 'both' },
          { id: 'd3', label: 'D3', emoji: '🍲', items: ['D3'], category: 'main', dietPreference: 'both' },
        ],
      },
    ] as any);

    await getVoteOptionsForDate('2026-06-11');

    const insertSql = insertQueries.find((sql) => sql.includes('INSERT INTO vote_options'));

    expect(insertSql).toBeDefined();
    expect(insertSql).not.toContain('original_catalog_id');
  });
});
