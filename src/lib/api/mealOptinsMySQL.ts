import { getMysqlPool } from '@/lib/db/mysql';
import { ensureMysqlSchema } from '@/lib/db/init';
import { isValidSqlDate } from '@/lib/validators/date';
import { getIstNow, getMealTiming } from '@/lib/utils/mealStatus';

export type MealSlotName = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export type MealOptinStatus = 'attending' | 'skip' | 'takeaway';
export type LegacyMealStatus = 'attending' | 'skipping' | 'takeaway';

export type MealRow = {
  id: string;
  name: MealSlotName;
  meal_date: string;
  created_at: string | null;
};

export function mealSlotId(mealDate: string, mealType: MealSlotName): string {
  return `meal-${mealDate}-${mealType}`;
}

export function normalizeMealStatus(status: string): MealOptinStatus {
  if (status === 'skip' || status === 'skipping') {
    return 'skip';
  }
  if (status === 'takeaway') {
    return 'takeaway';
  }
  return 'attending';
}

export async function ensureMealSlotsForDate(mealDate: string): Promise<void> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const types: MealSlotName[] = ['breakfast', 'lunch', 'snack', 'dinner'];
  for (const name of types) {
    const id = mealSlotId(mealDate, name);
    await pool.execute(
      `INSERT IGNORE INTO meals (id, meal_date, name, created_at) VALUES (?, ?, ?, NOW())`,
      [id, mealDate, name]
    );
  }
}

export async function optInMeal(input: {
  studentId: string;
  mealId: string;
  status: MealOptinStatus | LegacyMealStatus | string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const raw = input.mealId.replace(/^meal-/, '');
  if (!(['breakfast', 'lunch', 'snack', 'dinner'] as const).includes(raw as MealSlotName)) {
    throw new Error('Invalid mealId');
  }
  return optInMealByDate({
    studentId: input.studentId,
    mealDate: today,
    mealType: raw as MealSlotName,
    status: input.status,
  });
}

export async function optInMealByDate(input: {
  studentId: string;
  mealDate: string;
  mealType: MealSlotName;
  status: MealOptinStatus | LegacyMealStatus | string;
}) {
  await ensureMysqlSchema();
  await ensureMealSlotsForDate(input.mealDate);
  // Enforce cutoff for snack opt-ins (OTP scan closed by cutoff)
  try {
    if (input.mealType === 'snack') {
      const timing = getMealTiming('snack');
      const istNow = getIstNow();
      const minutes = istNow.getUTCHours() * 60 + istNow.getUTCMinutes();
      if (minutes >= timing.cutoffMinutes) {
        throw new Error('Snack opt-ins are closed for today');
      }
    }
  } catch (e) {
    // If any timing lookup fails, continue and let DB handle validation
  }
  const pool = getMysqlPool();
  const normalizedStatus = normalizeMealStatus(String(input.status));
  if (!isValidSqlDate(input.mealDate)) {
    throw new Error(`Invalid mealDate provided: "${input.mealDate}"`);
  }
  const mealId = mealSlotId(input.mealDate, input.mealType);
  const stableId = `optin-${input.studentId}-${mealId}`;

  await pool.execute(
    `INSERT INTO meal_optins (id, student_id, meal_id, meal_date, meal_type, optin_status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE optin_status = VALUES(optin_status), updated_at = NOW()`,
    [stableId, input.studentId, mealId, input.mealDate, input.mealType, normalizedStatus]
  );

  const [rows] = await pool.execute(
    `SELECT mo.id, mo.student_id, mo.meal_id, mo.meal_date, mo.meal_type, mo.optin_status AS status, mo.updated_at
     FROM meal_optins mo WHERE mo.id = ?`,
    [stableId]
  );

  return (rows as Record<string, unknown>[])[0];
}

export async function getMealCountsByDate(date: string) {
  await ensureMysqlSchema();
  await ensureMealSlotsForDate(date);
  const pool = getMysqlPool();

  try {
    const [rows] = await pool.execute(
      `SELECT m.id AS meal_id,
              m.name AS meal_type,
              m.meal_date,
              COALESCE(SUM(CASE WHEN mo.optin_status IN ('attending', 'takeaway') THEN 1 ELSE 0 END), 0) AS confirmed,
              COALESCE(SUM(CASE WHEN mo.optin_status IN ('attending', 'takeaway') AND u.food_preference = 'veg' THEN 1 ELSE 0 END), 0) AS veg_confirmed,
              COALESCE(SUM(CASE WHEN mo.optin_status IN ('attending', 'takeaway') AND u.food_preference = 'non_veg' THEN 1 ELSE 0 END), 0) AS non_veg_confirmed,
              COALESCE(SUM(CASE WHEN mo.optin_status = 'skip' THEN 1 ELSE 0 END), 0) AS skipped
       FROM meals m
       LEFT JOIN meal_optins mo ON mo.meal_id = m.id
       LEFT JOIN users u ON mo.student_id = u.id
       WHERE m.meal_date = ?
       GROUP BY m.id, m.name, m.meal_date
      ORDER BY FIELD(m.name, 'breakfast', 'lunch', 'snack', 'dinner')`,
      [date]
    );

    return rows as Record<string, unknown>[];
  } catch (error) {
    console.error('getMealCountsByDate query failed, falling back to basic counts:', error);
    
    // Fallback query without diet join to ensure API doesn't crash
    const [rows] = await pool.execute(
      `SELECT m.id AS meal_id,
              m.name AS meal_type,
              m.meal_date,
              COALESCE(SUM(CASE WHEN mo.optin_status IN ('attending', 'takeaway') THEN 1 ELSE 0 END), 0) AS confirmed,
              0 AS veg_confirmed,
              0 AS non_veg_confirmed,
              COALESCE(SUM(CASE WHEN mo.optin_status = 'skip' THEN 1 ELSE 0 END), 0) AS skipped
       FROM meals m
       LEFT JOIN meal_optins mo ON mo.meal_id = m.id
       WHERE m.meal_date = ?
       GROUP BY m.id, m.name, m.meal_date
      ORDER BY FIELD(m.name, 'breakfast', 'lunch', 'snack', 'dinner')`,
      [date]
    );
    return rows as Record<string, unknown>[];
  }
}

export async function getStudentOptins(studentId: string, mealDate: string) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  
  // Use meal_date and student_id for more reliable lookup
  const [rows] = await pool.execute(
    `SELECT 
      mo.id, 
      mo.student_id, 
      mo.meal_id, 
      mo.meal_date, 
      mo.meal_type, 
      mo.optin_status AS status, 
      mo.updated_at,
      m.name as meal_name
     FROM meal_optins mo
     LEFT JOIN meals m ON mo.meal_id = m.id
     WHERE mo.student_id = ? AND mo.meal_date = ?`,
    [studentId, mealDate]
  );
  return rows as any[];
}

export async function getStudentOptinsInRange(studentId: string, startDate: string, endDate: string) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [rows] = await pool.execute(
    `SELECT meal_date, meal_type, optin_status
     FROM meal_optins
     WHERE student_id = ? AND meal_date BETWEEN ? AND ?
     ORDER BY meal_date DESC, FIELD(meal_type, 'breakfast', 'lunch', 'snack', 'dinner')`,
    [studentId, startDate, endDate]
  );

  return rows as Array<{ meal_date: string; meal_type: MealSlotName; optin_status: MealOptinStatus }>;
}

export async function getMealsCatalogForDate(date: string): Promise<MealRow[]> {
  await ensureMysqlSchema();
  await ensureMealSlotsForDate(date);
  const pool = getMysqlPool();

  const [rows] = await pool.execute(
    `SELECT id, name, meal_date, created_at FROM meals WHERE meal_date = ? ORDER BY FIELD(name, 'breakfast', 'lunch', 'snack', 'dinner')`,
    [date]
  );

  return rows as MealRow[];
}

export async function getMealStats(startDate: string, endDate: string) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [rows] = await pool.execute(
    `SELECT meal_date,
            meal_type,
            COUNT(*) AS total_optins,
            SUM(CASE WHEN optin_status IN ('attending', 'takeaway') THEN 1 ELSE 0 END) AS attending_or_takeaway,
            SUM(CASE WHEN optin_status = 'skip' THEN 1 ELSE 0 END) AS skipped
     FROM meal_optins
     WHERE meal_date BETWEEN ? AND ?
     GROUP BY meal_date, meal_type
     ORDER BY meal_date, FIELD(meal_type, 'breakfast', 'lunch', 'snack', 'dinner')`,
    [startDate, endDate]
  );

  return rows as Record<string, unknown>[];
}
