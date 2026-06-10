import { getMysqlPool } from '@/lib/db/mysql';
import { ensureMysqlSchema } from '@/lib/db/init';

export function normalizeDishName(dishName: string): string {
  const trimmed = String(dishName || '').trim();
  if (!trimmed) return '';

  const cleaned = trimmed
    .replace(/\s*\+\s*/g, ' + ')
    .replace(/\s+/g, ' ')
    .replace(/\bchappathi\b/gi, 'Chapati')
    .replace(/\bchapathi\b/gi, 'Chapati')
    .replace(/\bidly\b/gi, 'Idli')
    .replace(/\bdosai\b/gi, 'Dosa')
    .replace(/\bpoha\b/gi, 'Poha')
    .replace(/\bpongal\b/gi, 'Pongal')
    .replace(/\bpappu\b/gi, 'Pappu');

  return cleaned
    .split(' ')
    .map((word) => (word === '+' ? '+' : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`))
    .join(' ');
}

export type MealRatingRow = {
  id: string;
  student_id: string;
  rating_date: string;
  meal_type: 'breakfast' | 'lunch' | 'snack' | 'dinner';
  dish_name: string | null;
  rating: number;
  waste_amount: string;
  created_at: string;
  updated_at: string;
};

export async function getRatings(studentId: string, ratingDate: string): Promise<Array<{
  meal_type: 'breakfast' | 'lunch' | 'snack' | 'dinner';
  rating: number;
  waste_amount: string;
}>> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [rows] = await pool.execute(
    `SELECT meal_type, rating, waste_amount
     FROM meal_ratings
     WHERE student_id = ? AND rating_date = ?
    ORDER BY FIELD(meal_type, 'breakfast', 'lunch', 'snack', 'dinner')`,
    [studentId, ratingDate]
  );

  return rows as Array<{ meal_type: 'breakfast' | 'lunch' | 'snack' | 'dinner'; rating: number; waste_amount: string }>;
}

export type DishRatingAggregate = {
  dish_name: string;
  avg_rating: number;
  rating_count: number;
};

export async function saveRating(input: {
  studentId: string;
  ratingDate: string;
  mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner';
  dishName: string;
  rating: number;
  wasteAmount: string;
}) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const normalizedDishName = normalizeDishName(input.dishName);
  const ratingId = `rating-${input.studentId}-${input.ratingDate}-${input.mealType}`;

  await pool.execute(
    `INSERT INTO meal_ratings (id, student_id, rating_date, meal_type, dish_name, rating, waste_amount, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       dish_name = VALUES(dish_name),
       rating = VALUES(rating),
       waste_amount = VALUES(waste_amount),
       updated_at = NOW()`,
    [ratingId, input.studentId, input.ratingDate, input.mealType, normalizedDishName, input.rating, input.wasteAmount]
  );
}

export async function updateRating(input: {
  studentId: string;
  ratingDate: string;
  mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner';
  dishName?: string;
  rating?: number;
  wasteAmount?: string;
}) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const setClauses: string[] = [];
  const values: Array<string | number | null> = [];

  if (input.dishName !== undefined) {
    setClauses.push('dish_name = ?');
    values.push(normalizeDishName(input.dishName));
  }
  if (input.rating !== undefined) {
    setClauses.push('rating = ?');
    values.push(input.rating);
  }
  if (input.wasteAmount !== undefined) {
    setClauses.push('waste_amount = ?');
    values.push(input.wasteAmount);
  }

  if (setClauses.length === 0) {
    return;
  }

  values.push(input.studentId, input.ratingDate, input.mealType);

  await pool.execute(
    `UPDATE meal_ratings
     SET ${setClauses.join(', ')}, updated_at = NOW()
     WHERE student_id = ? AND rating_date = ? AND meal_type = ?`,
    values
  );
}

export async function getDishRatingAggregates(ratingDate?: string): Promise<DishRatingAggregate[]> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const conditions = [`dish_name IS NOT NULL`, `dish_name NOT LIKE 'Standard %'`, `dish_name NOT LIKE 'Evening %'`, `dish_name <> '...'`];
  const values: Array<string> = [];

  if (ratingDate) {
    conditions.push('rating_date = ?');
    values.push(ratingDate);
  }

  const [rows] = await pool.execute(
    `SELECT dish_name, rating
     FROM meal_ratings
     WHERE ${conditions.join(' AND ')}`,
    values
  );

  const aggregates = new Map<string, { dish_name: string; total: number; rating_count: number }>();

  for (const row of rows as any[]) {
    const rawDishName = String(row.dish_name || '');
    const dishName = normalizeDishName(rawDishName);
    if (!dishName) continue;

    const entry = aggregates.get(dishName) ?? { dish_name: dishName, total: 0, rating_count: 0 };
    entry.total += Number(row.rating || 0);
    entry.rating_count += 1;
    aggregates.set(dishName, entry);
  }

  return Array.from(aggregates.values())
    .map(item => ({
      dish_name: item.dish_name,
      avg_rating: item.rating_count > 0 ? item.total / item.rating_count : 0,
      rating_count: item.rating_count,
    }))
    .sort((a, b) => b.avg_rating - a.avg_rating);
}

export async function getDailyRatingTrend(days = 7): Promise<Array<{ rating_date: string; avg_rating: number; total_ratings: number }>> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [rows] = await pool.execute(
    `SELECT rating_date,
            COALESCE(AVG(rating), 0) AS avg_rating,
            COUNT(*) AS total_ratings
     FROM meal_ratings
     WHERE rating_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY rating_date
     ORDER BY rating_date ASC`,
    [days - 1]
  );

  return (rows as any[]).map((row) => ({
    rating_date: String(row.rating_date),
    avg_rating: Number(row.avg_rating || 0),
    total_ratings: Number(row.total_ratings || 0),
  }));
}

export async function getMealTypeRatingAverages(days = 7, ratingDate?: string): Promise<Array<{ meal_type: string; avg_rating: number; total_ratings: number }>> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  if (ratingDate) {
    const [rows] = await pool.execute(
      `SELECT meal_type,
              COALESCE(AVG(rating), 0) AS avg_rating,
              COUNT(*) AS total_ratings
       FROM meal_ratings
       WHERE rating_date = ?
       GROUP BY meal_type
       ORDER BY FIELD(meal_type, 'breakfast', 'lunch', 'snack', 'dinner')`,
      [ratingDate]
    );

    return (rows as any[]).map((row) => ({
      meal_type: String(row.meal_type),
      avg_rating: Number(row.avg_rating || 0),
      total_ratings: Number(row.total_ratings || 0),
    }));
  }

  const [rows] = await pool.execute(
    `SELECT meal_type,
            COALESCE(AVG(rating), 0) AS avg_rating,
            COUNT(*) AS total_ratings
     FROM meal_ratings
     WHERE rating_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY meal_type
     ORDER BY FIELD(meal_type, 'breakfast', 'lunch', 'snack', 'dinner')`,
    [days - 1]
  );

  return (rows as any[]).map((row) => ({
    meal_type: String(row.meal_type),
    avg_rating: Number(row.avg_rating || 0),
    total_ratings: Number(row.total_ratings || 0),
  }));
}

export async function countStudentRatings(studentId: string): Promise<number> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS count FROM meal_ratings WHERE student_id = ?`,
    [studentId]
  );

  return Number((rows as any[])[0]?.count ?? 0);
}