import { getMysqlPool } from '@/lib/db/mysql';
import { ensureMysqlSchema } from '@/lib/db/init';
import crypto from 'crypto';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  created_at: string;
};

export async function createNotification(input: {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
}) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const id = `notif-${crypto.randomUUID()}`;

  await pool.execute(
    `INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, FALSE, NOW())`,
    [id, input.userId, input.title, input.message, input.type || 'info']
  );

  return { id };
}

export async function createGlobalNotification(input: {
  title: string;
  message: string;
  type?: NotificationType;
}) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  
  // Get all students
  const [students] = await pool.execute('SELECT id FROM users WHERE role = "student"');
  
  for (const student of students as any[]) {
    await createNotification({
      userId: student.id,
      title: input.title,
      message: input.message,
      type: input.type,
    });
  }
}

export async function getNotifications(userId: string): Promise<NotificationRow[]> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [rows] = await pool.execute(
    `SELECT id, user_id, title, message, type, is_read, created_at
     FROM notifications
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId]
  );

  return rows as NotificationRow[];
}

export async function markAsRead(id: string) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  await pool.execute(
    `UPDATE notifications SET is_read = TRUE WHERE id = ?`,
    [id]
  );
}
