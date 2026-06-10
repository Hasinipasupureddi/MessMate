import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { authenticateUser } from './authMySQL';
import { ensureMysqlSchema } from '@/lib/db/init';
import { getMysqlPool } from '@/lib/db/mysql';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function createResetUrl(token: string): string {
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${origin}/sign-up-login-screen/reset-password?token=${encodeURIComponent(token)}`;
}

async function updateUserPassword(userId: string, newPassword: string): Promise<void> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const passwordHash = await bcrypt.hash(newPassword, 10);

  await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
}

export async function requestPasswordReset(email: string): Promise<{ resetUrl: string } | null> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const normalizedEmail = email.trim().toLowerCase();

  const [rows] = await pool.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const user = (rows as Array<{ id: string }>)[0];
  const token = createToken();
  const tokenHash = hashToken(token);
  const resetId = `pr-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

  await pool.execute(
    `DELETE FROM password_reset_tokens
     WHERE user_id = ? OR expires_at < NOW() OR used_at IS NOT NULL`,
    [user.id]
  );

  await pool.execute(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
    [resetId, user.id, tokenHash]
  );

  return { resetUrl: createResetUrl(token) };
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  if (newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const tokenHash = hashToken(token);

  const [rows] = await pool.execute(
    `SELECT id, user_id
     FROM password_reset_tokens
     WHERE token_hash = ?
       AND used_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Invalid or expired reset token.');
  }

  const record = (rows as Array<{ id: string; user_id: string }>)[0];
  await updateUserPassword(record.user_id, newPassword);
  await pool.execute('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?', [record.id]);
}

export async function changePasswordWithCurrentCredentials(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  if (newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const user = await authenticateUser(email, currentPassword);
  await updateUserPassword(user.id, newPassword);
}