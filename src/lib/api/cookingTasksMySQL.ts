import { getMysqlPool } from '@/lib/db/mysql';
import { ensureMysqlSchema } from '@/lib/db/init';

export type CookingTaskStatus = 'pending' | 'cooking' | 'ready' | 'served';
export type CookingTaskRow = {
  id: string;
  task_date: string;
  meal_type: 'breakfast' | 'lunch' | 'snack' | 'dinner';
  task_name: string;
  status: string;
  assigned_to?: string | null;
  portions?: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Map UI status names to database format
 */
export function normalizeCookingStatus(status: string): string {
  // Status comes from API already in database format: pending, in_progress, done
  // Just validate it
  const validDbStatuses = ['pending', 'in_progress', 'done'];
  if (validDbStatuses.includes(status)) {
    return status;
  }
  // Fallback for legacy UI format values
  const legacyMap: Record<string, string> = {
    'cooking': 'in_progress',
    'ready': 'done',
    'served': 'done',
  };
  return legacyMap[status] || 'pending';
}

/**
 * Map database status to UI format
 */
export function uiCookingStatus(dbStatus: string): CookingTaskStatus {
  const map: Record<string, CookingTaskStatus> = {
    'pending': 'pending',
    'in_progress': 'cooking',
    'done': 'served',
  };
  return (map[dbStatus] || 'pending') as CookingTaskStatus;
}

export async function getCookingTasksByDate(taskDate: string): Promise<CookingTaskRow[]> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [rows] = await pool.execute(
    `SELECT id, task_date, meal_type, task_name, status, assigned_to, portions, notes, created_at, updated_at
     FROM cooking_tasks
     WHERE task_date = ?
     ORDER BY FIELD(meal_type, 'breakfast', 'lunch', 'snack', 'dinner'), task_name ASC`,
    [taskDate]
  );

  return (rows as CookingTaskRow[]) || [];
}

/**
 * Get a single cooking task by ID
 */
export async function getCookingTask(taskId: string): Promise<CookingTaskRow | null> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [rows] = await pool.execute(
    `SELECT id, task_date, meal_type, task_name, status, assigned_to, portions, notes, created_at, updated_at
     FROM cooking_tasks
     WHERE id = ?
     LIMIT 1`,
    [taskId]
  );

  const tasks = rows as CookingTaskRow[];
  return tasks.length > 0 ? tasks[0] : null;
}

/**
 * Create a new cooking task
 */
export async function createCookingTask(input: {
  taskId?: string;
  taskDate: string;
  mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner';
  taskName: string;
  status?: string;
  assignedTo?: string;
  portions?: number;
  notes?: string;
}): Promise<CookingTaskRow> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const taskId = input.taskId || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const dbStatus = normalizeCookingStatus(input.status || 'pending');

  await pool.execute(
    `INSERT INTO cooking_tasks (id, task_date, meal_type, task_name, status, assigned_to, portions, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      taskId,
      input.taskDate,
      input.mealType,
      input.taskName,
      dbStatus,
      input.assignedTo || null,
      input.portions || 0,
      input.notes || null
    ]
  );

  const task = await getCookingTask(taskId);
  if (!task) {
    throw new Error('Failed to create cooking task');
  }
  return task;
}

/**
 * Update cooking task status
 */
export async function updateCookingTaskStatus(taskId: string, status: string): Promise<CookingTaskRow> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const dbStatus = normalizeCookingStatus(status);

  const [result] = await pool.execute(
    `UPDATE cooking_tasks SET status = ?, updated_at = NOW() WHERE id = ?`,
    [dbStatus, taskId]
  );

  const task = await getCookingTask(taskId);
  if (!task) {
    throw new Error('Cooking task not found');
  }
  return task;
}

/**
 * Update cooking task assigned staff member
 */
export async function updateCookingTaskAssignment(taskId: string, assignedTo: string): Promise<CookingTaskRow> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [result] = await pool.execute(
    `UPDATE cooking_tasks SET assigned_to = ?, updated_at = NOW() WHERE id = ?`,
    [assignedTo.trim() || null, taskId]
  );

  const task = await getCookingTask(taskId);
  if (!task) {
    throw new Error('Cooking task not found');
  }
  return task;
}

/**
 * Update both cooking task status and assignment
 */
export async function updateCookingTask(taskId: string, updates: { status?: string; assignedTo?: string }): Promise<CookingTaskRow> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const updateFields: string[] = [];
  const updateValues: any[] = [];

  if (updates.status !== undefined) {
    updateFields.push('status = ?');
    updateValues.push(normalizeCookingStatus(updates.status));
  }

  if (updates.assignedTo !== undefined) {
    updateFields.push('assigned_to = ?');
    updateValues.push(updates.assignedTo.trim() || null);
  }

  if (updateFields.length === 0) {
    const task = await getCookingTask(taskId);
    if (!task) {
      throw new Error('Cooking task not found');
    }
    return task;
  }

  updateFields.push('updated_at = NOW()');
  updateValues.push(taskId);

  const query = `UPDATE cooking_tasks SET ${updateFields.join(', ')} WHERE id = ?`;
  await pool.execute(query, updateValues);

  const task = await getCookingTask(taskId);
  if (!task) {
    throw new Error('Cooking task not found');
  }
  return task;
}

/**
 * Bulk update cooking tasks for a date/meal
 */
export async function updateCookingTasksForMeal(taskDate: string, mealType: string, status: string): Promise<number> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const dbStatus = normalizeCookingStatus(status);

  const [result] = await pool.execute(
    `UPDATE cooking_tasks SET status = ?, updated_at = NOW() WHERE task_date = ? AND meal_type = ?`,
    [dbStatus, taskDate, mealType]
  );

  return (result as any).affectedRows || 0;
}

/**
 * Delete a cooking task
 */
export async function deleteCookingTask(taskId: string): Promise<boolean> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [result] = await pool.execute(
    `DELETE FROM cooking_tasks WHERE id = ?`,
    [taskId]
  );

  return (result as any).affectedRows > 0;
}
