import { getMysqlPool } from '@/lib/db/mysql';
import { ensureMysqlSchema } from '@/lib/db/init';
import { getIstNow, parseIstDatetime, toSqlDatetime } from '@/lib/utils/mealStatus';

export type LeftoverRow = {
  id: string;
  meal_date: string;
  meal_type: 'breakfast' | 'lunch' | 'snack' | 'dinner';
  dish_name: string;
  emoji: string | null;
  total_portions: number;
  claimed_count: number;
  available_until: string;
  status: 'available' | 'claimed' | 'expired' | 'cancelled';
  is_active: number | boolean;
};

export type LeftoverDeclarationStatus = 'pending' | 'declared' | 'none';

export type LeftoverDeclarationRow = {
  id: string;
  meal_date: string;
  meal_type: 'breakfast' | 'lunch' | 'snack' | 'dinner';
  status: LeftoverDeclarationStatus;
  declared_by: string | null;
  note: string | null;
  dish_name: string | null;
  emoji: string | null;
  total_portions: number | null;
  available_until: string | null;
  is_active: number | boolean;
  created_at: string;
  updated_at: string;
};

export type LeftoverChecklistRow = {
  id: string;
  checklist_date: string;
  item_key: string;
  label: string;
  is_done: boolean;
  created_at: string;
  updated_at: string;
};

export async function listLeftovers(mealDate: string): Promise<LeftoverRow[]> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  console.log(`[listLeftovers] Querying for date: ${mealDate}`);

  // Filter out expired items and only show active available items.
  // We preserve the date values from SQL and let the application handle IST-aware expiry checks.
  const [rows] = await pool.execute(
    `SELECT id, meal_date, meal_type, dish_name, emoji, total_portions, claimed_count, available_until, status, is_active
     FROM leftover_items
     WHERE meal_date = ? AND is_active = TRUE AND status = 'available'
     ORDER BY FIELD(meal_type, 'breakfast', 'lunch', 'snack', 'dinner')`,
    [mealDate]
  );

  console.log(`[listLeftovers] Found ${Array.isArray(rows) ? rows.length : 0} rows`);
  return rows as LeftoverRow[];
}

export async function listLeftoverDeclarations(mealDate: string): Promise<LeftoverDeclarationRow[]> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  console.log(`[listLeftoverDeclarations] Querying for date: ${mealDate}`);

  const [rows] = await pool.execute(
    `SELECT id, meal_date, meal_type, status, declared_by, note, dish_name, emoji, total_portions, available_until, is_active, created_at, updated_at
     FROM leftover_declarations
     WHERE meal_date = ?
     ORDER BY FIELD(meal_type, 'breakfast', 'lunch', 'snack', 'dinner')`,
    [mealDate]
  );

  console.log(`[listLeftoverDeclarations] Found ${Array.isArray(rows) ? rows.length : 0} rows`);
  return rows as LeftoverDeclarationRow[];
}

export async function saveLeftoverDeclaration(input: {
  mealDate: string;
  mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner';
  status: LeftoverDeclarationStatus;
  declaredBy: string;
  note?: string | null;
  dishName?: string | null;
  emoji?: string | null;
  totalPortions?: number | null;
  availableUntil?: string | null;
}): Promise<LeftoverDeclarationRow> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const declarationId = `leftover-declaration-${input.mealDate}-${input.mealType}`;
  const isActive = input.status !== 'pending';
  const sqlAvailableUntil = input.availableUntil ? toSqlDatetime(input.availableUntil) : null;

  console.log(`[RCI] Saving declaration for ${input.mealDate} ${input.mealType}. Status: ${input.status}`);

  await pool.execute(
    `INSERT INTO leftover_declarations (id, meal_date, meal_type, status, declared_by, note, dish_name, emoji, total_portions, available_until, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status), declared_by = VALUES(declared_by), note = VALUES(note), dish_name = VALUES(dish_name), emoji = VALUES(emoji), total_portions = VALUES(total_portions), available_until = VALUES(available_until), is_active = VALUES(is_active), updated_at = NOW()`,
    [declarationId, input.mealDate, input.mealType, input.status, input.declaredBy, input.note ?? null, input.dishName ?? null, input.emoji ?? null, input.totalPortions ?? null, sqlAvailableUntil, isActive]
  );

  if (input.status === 'declared') {
    const itemId = `leftover-${input.mealDate}-${input.mealType}`;
    await pool.execute(
      `INSERT INTO leftover_items (id, meal_date, meal_type, dish_name, emoji, total_portions, claimed_count, available_until, status, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'available', TRUE)
       ON DUPLICATE KEY UPDATE dish_name = VALUES(dish_name), emoji = VALUES(emoji), total_portions = VALUES(total_portions), claimed_count = 0, available_until = VALUES(available_until), status = 'available', is_active = TRUE, updated_at = NOW()`,
      [itemId, input.mealDate, input.mealType, input.dishName ?? '', input.emoji ?? '', input.totalPortions ?? 0, sqlAvailableUntil]
    );
  }

  if (input.status === 'none') {
    await pool.execute(
      `UPDATE leftover_items SET is_active = FALSE, updated_at = NOW() WHERE meal_date = ? AND meal_type = ?`,
      [input.mealDate, input.mealType]
    );
  }

  const [rows] = await pool.execute(
    `SELECT id, meal_date, meal_type, status, declared_by, note, dish_name, emoji, total_portions, available_until, is_active, created_at, updated_at
     FROM leftover_declarations
     WHERE id = ?`,
    [declarationId]
  );

  return (rows as LeftoverDeclarationRow[])[0];
}

export async function deleteLeftoverDeclaration(mealDate: string, mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner'): Promise<void> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const declarationId = `leftover-declaration-${mealDate}-${mealType}`;
  const itemId = `leftover-${mealDate}-${mealType}`;

  // Start a transaction to ensure both are deleted
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Delete claims first due to potential logical dependency
    await connection.execute(`DELETE FROM leftover_claims WHERE leftover_id = ?`, [itemId]);
    await connection.execute(`DELETE FROM leftover_items WHERE id = ?`, [itemId]);
    await connection.execute(`DELETE FROM leftover_declarations WHERE id = ?`, [declarationId]);
    
    await connection.commit();
    console.log(`[RCI] Deleted declaration and item for ${mealDate} ${mealType}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getLeftoverDeclarationSummary(mealDate: string) {
  const declarations = await listLeftoverDeclarations(mealDate);
  if (declarations.length === 0) {
    return { overallStatus: 'pending' as LeftoverDeclarationStatus, meals: [] };
  }

  const overallStatus: LeftoverDeclarationStatus = declarations.some((declaration) => declaration.status === 'declared')
    ? 'declared'
    : declarations.every((declaration) => declaration.status === 'none')
    ? 'none'
    : 'pending';

  return {
    overallStatus,
    meals: declarations.map((declaration) => ({
      mealType: declaration.meal_type,
      status: declaration.status,
      note: declaration.note,
      dishName: declaration.dish_name,
    })),
  };
}

export async function listLeftoverChecklistItems(checklistDate: string): Promise<LeftoverChecklistRow[]> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [rows] = await pool.execute(
    `SELECT id, checklist_date, item_key, label, is_done, created_at, updated_at
     FROM leftover_checklist
     WHERE checklist_date = ?
     ORDER BY item_key`,
    [checklistDate]
  );

  const items = rows as LeftoverChecklistRow[];
  if (items.length > 0) {
    return items;
  }

  const defaultTasks = [
    { itemKey: 'declare_leftovers', label: 'Confirm leftovers declared' },
    { itemKey: 'verify_pickup_window', label: 'Verify pickup window' },
    { itemKey: 'notify_students', label: 'Notify students' },
  ];

  const inserts = defaultTasks.map((task) => [
    `checklist-${checklistDate}-${task.itemKey}`,
    checklistDate,
    task.itemKey,
    task.label,
    false,
  ]);

  await Promise.all(
    inserts.map((params) =>
      pool.execute(
        `INSERT INTO leftover_checklist (id, checklist_date, item_key, label, is_done) VALUES (?, ?, ?, ?, ?)`,
        params
      )
    )
  );

  const [reloadedRows] = await pool.execute(
    `SELECT id, checklist_date, item_key, label, is_done, created_at, updated_at
     FROM leftover_checklist
     WHERE checklist_date = ?
     ORDER BY item_key`,
    [checklistDate]
  );

  return reloadedRows as LeftoverChecklistRow[];
}

export async function toggleLeftoverChecklistItem(checklistDate: string, itemKey: string, isDone: boolean): Promise<LeftoverChecklistRow | null> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [result] = await pool.execute(
    `UPDATE leftover_checklist SET is_done = ?, updated_at = NOW() WHERE checklist_date = ? AND item_key = ?`,
    [isDone ? 1 : 0, checklistDate, itemKey]
  );

  const [rows] = await pool.execute(
    `SELECT id, checklist_date, item_key, label, is_done, created_at, updated_at
     FROM leftover_checklist
     WHERE checklist_date = ? AND item_key = ?
     LIMIT 1`,
    [checklistDate, itemKey]
  );

  const items = rows as LeftoverChecklistRow[];
  return items[0] ?? null;
}

export async function claimLeftover(input: { leftoverId: string; userId: string }): Promise<{ success: boolean; message: string }> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT id, meal_date, meal_type, dish_name, emoji, total_portions, claimed_count, available_until, status, is_active
       FROM leftover_items
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [input.leftoverId]
    );

    const items = rows as LeftoverRow[];
    const item = items[0];

    if (!item) {
      await connection.rollback();
      return { success: false, message: 'Item not found.' };
    }

    if (!item.is_active || item.status !== 'available') {
      await connection.rollback();
      return { success: false, message: 'Item is no longer available.' };
    }

    if (parseIstDatetime(String(item.available_until)) <= getIstNow()) {
      await connection.rollback();
      return { success: false, message: 'Claim window is closed.' };
    }

    if (item.claimed_count >= item.total_portions) {
      await connection.rollback();
      return { success: false, message: 'No portions left.' };
    }

    const [existingRows] = await connection.execute(
      `SELECT id FROM leftover_claims WHERE leftover_id = ? AND user_id = ? LIMIT 1 FOR UPDATE`,
      [input.leftoverId, input.userId]
    );

    if ((existingRows as Array<{ id: string }>).length > 0) {
      await connection.rollback();
      return { success: false, message: 'You already claimed this item.' };
    }

    const claimId = `claim-${input.leftoverId}-${input.userId}`;
    await connection.execute(
      `INSERT INTO leftover_claims (id, leftover_id, user_id, claimed_at)
       VALUES (?, ?, ?, NOW())`,
      [claimId, input.leftoverId, input.userId]
    );

    await connection.execute(
      `UPDATE leftover_items SET claimed_count = claimed_count + 1, status = IF(claimed_count + 1 >= total_portions, 'claimed', 'available'), updated_at = NOW() WHERE id = ?`,
      [input.leftoverId]
    );

    await connection.commit();
    return { success: true, message: 'Claim successful.' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function countStudentLeftoverClaims(userId: string): Promise<number> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS count FROM leftover_claims WHERE user_id = ?`,
    [userId]
  );

  return Number((rows as any[])[0]?.count ?? 0);
}