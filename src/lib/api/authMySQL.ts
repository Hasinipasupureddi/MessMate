import bcrypt from 'bcryptjs';
import { getMysqlPool } from '@/lib/db/mysql';
import { ensureMysqlSchema } from '@/lib/db/init';

export type ProfileRole = 'student' | 'staff' | 'warden';
export type AccountStatus = 'pending' | 'approved' | 'rejected' | 'disabled';

export async function authenticateUser(identifier: string, password: string) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  
  // Try to find by email or roll_no
  const [rows] = await pool.execute(
    'SELECT id, roll_no, email, password_hash, name, role, hostel_id, food_preference, account_status, email_verified FROM users WHERE email = ? OR roll_no = ? LIMIT 1',
    [identifier.toLowerCase(), identifier.toUpperCase()]
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Invalid credentials');
  }

  const user = (rows as any[])[0];
  
  if (String(user.account_status) !== 'approved') {
    if (String(user.account_status) === 'pending') {
      throw new Error('Account pending approval');
    }
    if (String(user.account_status) === 'rejected') {
      throw new Error('Account rejected by warden');
    }
    if (String(user.account_status) === 'disabled') {
      throw new Error('Account disabled. Contact your warden.');
    }
    throw new Error('Account not approved for login');
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    throw new Error('Invalid credentials');
  }

  return {
    id: user.id,
    rollNo: user.roll_no,
    email: user.email,
    name: user.name,
    role: user.role as ProfileRole,
    hostelId: user.hostel_id,
    foodPreference: user.food_preference as 'veg' | 'non_veg',
    emailVerified: Boolean(user.email_verified),
  };
}

export async function createUser(userData: {
  rollNo?: string;
  email: string;
  password: string;
  name: string;
  role: ProfileRole;
  hostelId?: string;
  foodPreference?: 'veg' | 'non_veg';
}) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  
  // If student, validate roll number
  if (userData.role === 'student' && userData.rollNo) {
    const rollNo = userData.rollNo.toUpperCase();
    
    // Check if an account already exists for this roll number
    const [existingRoll] = await pool.execute(
      'SELECT id FROM users WHERE roll_no = ? LIMIT 1',
      [rollNo]
    );

    if (Array.isArray(existingRoll) && existingRoll.length > 0) {
      throw new Error('This roll number is already registered.');
    }
  }

  // Check if email already exists
  const [existingEmail] = await pool.execute(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [userData.email.toLowerCase()]
  );

  if (Array.isArray(existingEmail) && existingEmail.length > 0) {
    throw new Error('This email is already registered.');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(userData.password, 10);
  const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Insert new user
  await pool.execute(
    `INSERT INTO users (id, roll_no, email, password_hash, name, role, hostel_id, food_preference, account_status, email_verified) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', TRUE)`,
    [
      userId, 
      userData.rollNo ? userData.rollNo.toUpperCase() : null, 
      userData.email.toLowerCase(), 
      passwordHash, 
      userData.name, 
      userData.role, 
      userData.hostelId || 'A',
      userData.foodPreference || 'non_veg'
    ]
  );

  return {
    id: userId,
    rollNo: userData.rollNo,
    email: userData.email,
    name: userData.name,
    role: userData.role,
    hostelId: userData.hostelId || 'A',
    foodPreference: userData.foodPreference || 'non_veg',
    emailVerified: true,
  };
}

export async function findUserByEmail(email: string) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [rows] = await pool.execute(
    `SELECT id, roll_no, email, name, role, hostel_id, food_preference, account_status, email_verified
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email.trim().toLowerCase()]
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const user = (rows as any[])[0];
  return {
    id: String(user.id),
    rollNo: user.roll_no ? String(user.roll_no) : undefined,
    email: String(user.email),
    name: String(user.name),
    role: user.role as ProfileRole,
    hostelId: String(user.hostel_id ?? 'A'),
    foodPreference: user.food_preference as 'veg' | 'non_veg',
    accountStatus: String(user.account_status) as AccountStatus,
    emailVerified: Boolean(user.email_verified),
  };
}

export async function listUsersByStatus(status: AccountStatus) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [rows] = await pool.execute(
    `SELECT id, roll_no, email, name, role, hostel_id, food_preference, account_status
     FROM users
     WHERE account_status = ?
     ORDER BY created_at DESC
     LIMIT 50`,
    [status]
  );

  return (rows as any[]).map((user) => ({
    id: String(user.id),
    rollNo: user.roll_no ? String(user.roll_no) : undefined,
    email: String(user.email),
    name: String(user.name),
    role: user.role as ProfileRole,
    hostelId: String(user.hostel_id ?? 'A'),
    foodPreference: user.food_preference as 'veg' | 'non_veg',
    accountStatus: String(user.account_status) as AccountStatus,
  }));
}

export async function updateUserAccountStatus(userId: string, status: AccountStatus) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  const [result] = await pool.execute(
    'UPDATE users SET account_status = ? WHERE id = ? LIMIT 1',
    [status, userId]
  );
  return result;
}
