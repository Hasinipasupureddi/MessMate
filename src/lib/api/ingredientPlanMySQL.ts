import { getMysqlPool } from '@/lib/db/mysql';
import { ensureMysqlSchema } from '@/lib/db/init';

export type DailyIngredientPlanRow = {
  id: string;
  plan_date: string;
  ingredient_id: string | null;
  ingredient_name: string;
  planned_qty: number;
  actual_qty: number | null;
  added_by: string | null;
  is_custom: boolean;
  is_removed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DailyIngredientPlanEntry = {
  id?: string;
  ingredientId?: string | null;
  ingredientName: string;
  plannedQty: number;
  actualQty?: number | null;
  isCustom?: boolean;
  isRemoved?: boolean;
  notes?: string | null;
};

export async function getDailyIngredientPlan(date: string): Promise<DailyIngredientPlanRow[]> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [rows] = await pool.execute(
    `SELECT id, plan_date, ingredient_id, ingredient_name, planned_qty, actual_qty, added_by, is_custom, is_removed, notes, created_at, updated_at
     FROM daily_ingredient_plan
     WHERE plan_date = ?
     ORDER BY created_at ASC`,
    [date]
  );

  return (rows as any[]).map((row) => ({
    id: String(row.id),
    plan_date: String(row.plan_date),
    ingredient_id: row.ingredient_id ? String(row.ingredient_id) : null,
    ingredient_name: String(row.ingredient_name),
    planned_qty: Number(row.planned_qty || 0),
    actual_qty: row.actual_qty !== null && row.actual_qty !== undefined ? Number(row.actual_qty) : null,
    added_by: row.added_by ? String(row.added_by) : null,
    is_custom: Boolean(row.is_custom),
    is_removed: Boolean(row.is_removed),
    notes: row.notes ? String(row.notes) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }));
}

export async function saveDailyIngredientPlan(
  date: string,
  entries: DailyIngredientPlanEntry[],
  addedBy?: string | null
): Promise<DailyIngredientPlanRow[]> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const normalizedEntries = entries.map((entry) => {
    const id = String(entry.id || `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    return {
      id,
      plan_date: date,
      ingredient_id: entry.ingredientId || null,
      ingredient_name: String(entry.ingredientName || '').trim() || 'Unnamed ingredient',
      planned_qty: Number(entry.plannedQty || 0),
      actual_qty: entry.actualQty === null || entry.actualQty === undefined ? null : Number(entry.actualQty),
      added_by: addedBy ? String(addedBy) : null,
      is_custom: Boolean(entry.isCustom),
      is_removed: Boolean(entry.isRemoved),
      notes: entry.notes ? String(entry.notes) : null,
    };
  });

  if (normalizedEntries.some((entry) => entry.planned_qty < 0)) {
    throw new Error('Planned quantity must be zero or greater.');
  }

  if (normalizedEntries.some((entry) => entry.actual_qty !== null && entry.actual_qty < 0)) {
    throw new Error('Actual quantity must be zero or greater.');
  }

  // Get a connection from the pool for transaction support
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    for (const entry of normalizedEntries) {
      await connection.execute(
        `INSERT INTO daily_ingredient_plan
           (id, plan_date, ingredient_id, ingredient_name, planned_qty, actual_qty, added_by, is_custom, is_removed, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           ingredient_id = VALUES(ingredient_id),
           ingredient_name = VALUES(ingredient_name),
           planned_qty = VALUES(planned_qty),
           actual_qty = VALUES(actual_qty),
           added_by = VALUES(added_by),
           is_custom = VALUES(is_custom),
           is_removed = VALUES(is_removed),
           notes = VALUES(notes),
           updated_at = NOW()`,
        [
          entry.id,
          entry.plan_date,
          entry.ingredient_id,
          entry.ingredient_name,
          entry.planned_qty,
          entry.actual_qty,
          entry.added_by,
          entry.is_custom ? 1 : 0,
          entry.is_removed ? 1 : 0,
          entry.notes,
        ]
      );
    }

    const entryIds = normalizedEntries.map((entry) => entry.id);
    if (entryIds.length > 0) {
      const placeholders = entryIds.map(() => '?').join(', ');
      await connection.execute(
        `DELETE FROM daily_ingredient_plan WHERE plan_date = ? AND id NOT IN (${placeholders})`,
        [date, ...entryIds]
      );
    } else {
      await connection.execute(`DELETE FROM daily_ingredient_plan WHERE plan_date = ?`, [date]);
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getDailyIngredientPlan(date);
}
