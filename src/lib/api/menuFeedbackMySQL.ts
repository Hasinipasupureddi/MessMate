import { getMysqlPool } from '@/lib/db/mysql';
import { ensureMysqlSchema } from '@/lib/db/init';

export type WardenMenuFeedbackRow = {
  id: string;
  menu_date: string;
  meal_type: 'breakfast' | 'lunch' | 'snack' | 'dinner' | null;
  warden_id: string;
  action: 'approve' | 'request_changes';
  comment: string | null;
  created_at: string;
};

export async function getLatestWardenMenuFeedback(menuDate: string): Promise<WardenMenuFeedbackRow | null> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [rows] = await pool.execute(
    `SELECT id, menu_date, meal_type, warden_id, action, comment, created_at
     FROM warden_menu_feedback
     WHERE menu_date = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [menuDate]
  );

  const feedback = (rows as WardenMenuFeedbackRow[]) || [];
  return feedback.length > 0 ? feedback[0] : null;
}

export async function saveWardenMenuFeedback(input: {
  menuDate: string;
  mealType?: 'breakfast' | 'lunch' | 'snack' | 'dinner' | null;
  wardenId: string;
  action: 'approve' | 'request_changes';
  comment: string | null;
}) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const id = `menu-feedback-${crypto.randomUUID()}`;

  await pool.execute(
    `INSERT INTO warden_menu_feedback (id, menu_date, meal_type, warden_id, action, comment, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      id,
      input.menuDate,
      input.mealType || null,
      input.wardenId,
      input.action,
      input.comment,
    ]
  );

  return {
    id,
    menu_date: input.menuDate,
    meal_type: input.mealType ?? null,
    warden_id: input.wardenId,
    action: input.action,
    comment: input.comment,
    created_at: new Date().toISOString(),
  };
}
