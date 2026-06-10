import { getMysqlPool } from '@/lib/db/mysql';
import { ensureMysqlSchema } from '@/lib/db/init';

export type ComplaintStatus = 'open' | 'in-progress' | 'resolved';

export type ComplaintRow = {
  id: string;
  student_id: string;
  student_name?: string | null;
  category: string;
  complaint_text: string;
  description?: string | null;
  status: ComplaintStatus;
  created_at: string;
  updated_at: string;
};

export function normalizeComplaintStatus(status: string): ComplaintStatus {
  if (status === 'resolved') {
    return 'resolved';
  }

  if (status === 'in-progress' || status === 'reviewing') {
    return 'in-progress';
  }

  return 'open';
}

export async function createComplaint(input: {
  studentId: string;
  category: string;
  complaintText: string;
}): Promise<ComplaintRow> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const complaintId = `complaint-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const description = input.complaintText.trim();

  await pool.execute(
    `INSERT INTO complaints (id, student_id, category, complaint_text, description, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'open', NOW(), NOW())`,
    [complaintId, input.studentId, input.category, input.complaintText, description]
  );

  const [rows] = await pool.execute(
    `SELECT c.id, c.student_id, u.name AS student_name, c.category, c.complaint_text, c.description, c.status, c.created_at, c.updated_at
     FROM complaints c
     INNER JOIN users u ON u.id = c.student_id
     WHERE c.id = ?
     LIMIT 1`,
    [complaintId]
  );

  const complaints = rows as ComplaintRow[];
  if (!complaints.length) {
    throw new Error('Failed to create complaint');
  }

  return complaints[0];
}

export async function listComplaintsForRole(role: 'staff' | 'warden') {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [rows] = await pool.execute(
    `SELECT c.id,
            c.student_id,
            u.name AS student_name,
            c.category,
            c.complaint_text,
            c.description,
            c.status,
            c.created_at,
            c.updated_at
     FROM complaints c
     INNER JOIN users u ON u.id = c.student_id
     WHERE ? = 'warden' OR c.status IN ('open', 'in-progress')
     ORDER BY c.created_at DESC`,
    [role]
  );

  return rows as ComplaintRow[];
}

export async function updateComplaintStatus(complaintId: string, status: ComplaintStatus) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  await pool.execute(
    `UPDATE complaints SET status = ?, updated_at = NOW() WHERE id = ?`,
    [status, complaintId]
  );

  const [rows] = await pool.execute(
    `SELECT c.id,
            c.student_id,
            u.name AS student_name,
            c.category,
            c.complaint_text,
            c.description,
            c.status,
            c.created_at,
            c.updated_at
     FROM complaints c
     INNER JOIN users u ON u.id = c.student_id
     WHERE c.id = ?
     LIMIT 1`,
    [complaintId]
  );

  const complaints = rows as ComplaintRow[];
  if (!complaints.length) {
    throw new Error('Complaint not found');
  }

  return complaints[0];
}