import { getMysqlPool } from '@/lib/db/mysql';
import { ensureMysqlSchema } from '@/lib/db/init';
import type { FinalMenuDay, FinalMenuItem, VoteAggregateRow, RatingAggregateMap } from '@/lib/menu/finalMenu';
import { buildFinalMenuDay } from '@/lib/menu/finalMenu';
import type { VoteMealType } from '@/lib/menu/votingBlueprints';
import { getDishRatingAggregates } from './mealRatingsMySQL';
import { getOptionById, getVoteOptionsForDate } from './voteOptionsMySQL';

export type FinalMenuRow = {
  menuDate: string;
  mealType: string;
  categoryKey: string;
  winningItemId: string;
  winningItemName: string;
  winningItemsJson: string;
  status: 'awaiting_approval' | 'approved';
  winnerSource: 'votes' | 'staff_override';
  overrideReason: string | null;
  generatedAt: string | null;
  updatedAt: string | null;
};

export type RotationDbRow = {
  mealType: VoteMealType;
  optionId: string;
  lastServedDate: string | null;
};

export async function getFinalMenuRows(menuDate: string) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [rows] = await pool.execute(
    `SELECT menu_date AS menuDate,
            meal_type AS mealType,
            category_key AS categoryKey,
            winning_item_id AS winningItemId,
            winning_item_name AS winningItemName,
            winning_items_json AS winningItemsJson,
            status,
            winner_source AS winnerSource,
            override_reason AS overrideReason,
            generated_at AS generatedAt,
            updated_at AS updatedAt
     FROM final_menu
     WHERE menu_date = ?
     ORDER BY FIELD(meal_type, 'breakfast', 'lunch', 'snack', 'dinner')`,
    [menuDate]
  );

  return rows as FinalMenuRow[];
}

export async function getFinalMenuRowsRange(startDate: string, endDate: string) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [rows] = await pool.execute(
    `SELECT menu_date AS menuDate,
            meal_type AS mealType,
            category_key AS categoryKey,
            winning_item_id AS winningItemId,
            winning_item_name AS winningItemName,
            winning_items_json AS winningItemsJson,
            status,
            winner_source AS winnerSource,
            override_reason AS overrideReason,
            generated_at AS generatedAt,
            updated_at AS updatedAt
     FROM final_menu
     WHERE menu_date BETWEEN ? AND ?
     ORDER BY menu_date DESC, FIELD(meal_type, 'breakfast', 'lunch', 'snack', 'dinner')`,
    [startDate, endDate]
  );

  return rows as FinalMenuRow[];
}

export async function getRotationRows(mealDate?: string) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [rows] = await pool.execute(
    `SELECT meal_type AS mealType,
            option_id AS optionId,
            last_served_date AS lastServedDate
     FROM menu_rotation${mealDate ? ' WHERE last_served_date IS NULL OR last_served_date < ?' : ''}`,
    mealDate ? [mealDate] : []
  );

  return rows as RotationDbRow[];
}

export async function getRatingMap(): Promise<RatingAggregateMap> {
  const aggregates = await getDishRatingAggregates();
  const map: RatingAggregateMap = new Map();
  aggregates.forEach(agg => {
    map.set(agg.dish_name, { avg_rating: agg.avg_rating, rating_count: agg.rating_count });
  });
  return map;
}

export async function saveFinalMenu(menu: FinalMenuDay, status: 'awaiting_approval' | 'approved' = 'awaiting_approval') {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  for (const meal of menu.meals) {
    await pool.execute(
      `INSERT INTO final_menu (menu_date, meal_type, category_key, winning_item_id, winning_item_name, winning_items_json, status, winner_source, override_reason, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         category_key = VALUES(category_key),
         winning_item_id = VALUES(winning_item_id),
         winning_item_name = VALUES(winning_item_name),
         winning_items_json = VALUES(winning_items_json),
         status = VALUES(status),
         winner_source = VALUES(winner_source),
         override_reason = VALUES(override_reason),
         generated_at = NOW()`,
      [
        menu.dateKey,
        meal.mealType,
        meal.winningItems[0]?.categoryKey ?? meal.mealType,
        meal.winningItems[0]?.selectedOptionId ?? 'fallback',
        meal.winningItems.map((item) => item.label).join(' + ') || 'TBD',
        JSON.stringify(meal.winningItems),
        status,
        meal.winnerSource ?? 'votes',
        meal.overrideReason ?? null,
      ]
    );
  }
}

export async function saveMenuRotation(menu: FinalMenuDay) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  for (const meal of menu.meals) {
    for (const item of meal.winningItems) {
      await pool.execute(
        `INSERT INTO menu_rotation (meal_type, option_id, last_served_date)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           last_served_date = VALUES(last_served_date)`,
        [meal.mealType, item.selectedOptionId, menu.dateKey]
      );
    }
  }
}

export async function getTotalStudentCount() {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const [rows] = await pool.execute("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
  return (rows as any)[0].count as number;
}

export async function buildFinalMenuFromVotes(
  menuDate: string,
  votes: VoteAggregateRow[] = [],
  status: 'awaiting_approval' | 'approved' = 'awaiting_approval'
) {
  const [totalStudents, ratingMap, rotationRows, dbOptions] = await Promise.all([
    getTotalStudentCount(),
    getRatingMap(),
    getRotationRows(),
    getVoteOptionsForDate(menuDate),
  ]);

  const rotationMap = new Map<string, string | null>();
  rotationRows.forEach(row => {
    const dateStr = row.lastServedDate ? new Date(row.lastServedDate).toISOString().slice(0, 10) : null;
    rotationMap.set(row.optionId, dateStr);
  });

  const menu = buildFinalMenuDay(
    new Date(`${menuDate}T00:00:00.000Z`),
    votes,
    ratingMap,
    totalStudents,
    rotationMap,
    dbOptions
  ) as FinalMenuDay;
  menu.status = status;
  return menu;
}

export async function generateAndSaveFinalMenu(
  menuDate: string,
  votes: VoteAggregateRow[] = [],
  status: 'awaiting_approval' | 'approved' = 'awaiting_approval'
) {
  const menu = await buildFinalMenuFromVotes(menuDate, votes, status);
  await saveFinalMenu(menu, status);
  if (status === 'approved') {
    await saveMenuRotation(menu);
  }
  return menu;
}

export function hydrateFinalMenuDay(menuDate: string, rows: FinalMenuRow[]): FinalMenuDay {
  const date = new Date(`${menuDate}T00:00:00.000Z`);
  const base = buildFinalMenuDay(date, []);
  const rowMap = new Map(rows.map((row) => [row.mealType, row]));
  const status = rows[0]?.status ?? 'awaiting_approval';

  return {
    ...base,
    status,
    generatedAt: rows[0]?.generatedAt ?? null,
    meals: base.meals.map((meal) => {
      const row = rowMap.get(meal.mealType);
      if (!row) {
        return meal;
      }

      let winningItems: FinalMenuItem[] = meal.winningItems;
      try {
        let parsed: unknown = row.winningItemsJson;
        if (typeof parsed === 'string') {
          parsed = JSON.parse(parsed);
        }

        if (Array.isArray(parsed)) {
          winningItems = parsed
            .map((entry) => {
              const optionId = String(entry.selectedOptionId ?? row.winningItemId ?? 'fallback');
              let dietPreference = entry.dietPreference;
              if (!dietPreference) {
                const opt = getOptionById(optionId);
                dietPreference = opt?.dietPreference || 'both';
              }
              let categoryKey = String(entry.categoryKey ?? row.categoryKey ?? 'main');
              if (!categoryKey || categoryKey === row.mealType) {
                const opt = getOptionById(optionId);
                categoryKey = opt?.categoryKey ?? opt?.category ?? 'main';
              }

              return {
                label: String(entry.label ?? row.winningItemName ?? 'TBD'),
                emoji: String(entry.emoji ?? '🍽️'),
                items: Array.isArray(entry.items) ? entry.items.map((item: unknown) => String(item)) : [],
                selectedOptionId: optionId,
                votes: Number(entry.votes ?? 0),
                dietPreference,
                categoryKey,
              };
            })
            .filter((entry) => entry.label);
        }
      } catch {
        winningItems = meal.winningItems;
      }

      return {
        ...meal,
        winningItems,
        winnerSource: row.winnerSource ?? 'votes',
        overrideReason: row.overrideReason ?? null,
        updatedAt: row.updatedAt ?? null,
      };
    }),
  };
}
