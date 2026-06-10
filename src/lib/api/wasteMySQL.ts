import { getMysqlPool } from '@/lib/db/mysql';
import { ensureMysqlSchema } from '@/lib/db/init';

export type WasteLogRow = {
  id: string;
  staff_id: string | null;
  log_date: string;
  meal_type: 'breakfast' | 'lunch' | 'snack' | 'dinner';
  dish_name: string;
  amount: number;
  unit: 'kg' | 'litres' | 'pcs';
  reason: string | null;
  created_at: string;
};

export async function getWasteLogs(date: string): Promise<WasteLogRow[]> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [rows] = await pool.execute(
    `SELECT id, staff_id, log_date, meal_type, dish_name, amount, unit, reason, created_at
     FROM waste_logs
     WHERE log_date = ?
     ORDER BY created_at DESC`,
    [date]
  );

  return rows as WasteLogRow[];
}

export async function createWasteLog(input: {
  staffId: string;
  logDate: string;
  mealType: string;
  dishName: string;
  amount: number;
  unit: string;
  reason: string;
}) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const id = `waste-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  await pool.execute(
    `INSERT INTO waste_logs (id, staff_id, log_date, meal_type, dish_name, amount, unit, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      id,
      input.staffId,
      input.logDate,
      input.mealType,
      input.dishName,
      input.amount,
      input.unit,
      input.reason,
    ]
  );

  return { id };
}
