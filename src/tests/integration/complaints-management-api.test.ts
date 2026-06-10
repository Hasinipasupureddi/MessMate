/** @jest-environment node */

import { GET } from '@/app/api/complaints/route';
import { PATCH } from '@/app/api/complaints/[id]/route';
import {
  listComplaintsForRole,
  updateComplaintStatus,
} from '@/lib/api/complaintsMySQL';
import { requireRole } from '@/lib/auth/guards';

jest.mock('@/lib/api/complaintsMySQL', () => ({
  listComplaintsForRole: jest.fn(),
  updateComplaintStatus: jest.fn(),
  createComplaint: jest.fn(),
  normalizeComplaintStatus: jest.requireActual('@/lib/api/complaintsMySQL').normalizeComplaintStatus,
}));

jest.mock('@/lib/auth/guards', () => ({
  requireRole: jest.fn(),
}));

describe('Complaints management API coverage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns staff-visible complaints', async () => {
    jest.mocked(requireRole).mockResolvedValue({
      ok: true,
      session: {
        sub: 'demo-staff-1',
        email: 'raju.cook@messmate.in',
        name: 'Raju Cook',
        role: 'staff',
        hostelId: 'A',
      },
    });

    jest.mocked(listComplaintsForRole).mockResolvedValue([
      {
        id: 'complaint-001',
        student_id: 'demo-student-1',
        student_name: 'Arjun Mehta',
        category: 'Hygiene',
        complaint_text: 'Need a cleaner dining hall.',
        description: 'Need a cleaner dining hall.',
        status: 'open',
        created_at: '2026-05-22T08:00:00.000Z',
        updated_at: '2026-05-22T08:00:00.000Z',
      },
    ]);

    const request = new Request('http://localhost/api/complaints?role=staff');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listComplaintsForRole).toHaveBeenCalledWith('staff');
    expect(body.rows[0]).toMatchObject({
      id: 'complaint-001',
      studentName: 'Arjun Mehta',
      status: 'open',
    });
  });

  it('updates a complaint status for staff', async () => {
    jest.mocked(requireRole).mockResolvedValue({
      ok: true,
      session: {
        sub: 'demo-staff-1',
        email: 'raju.cook@messmate.in',
        name: 'Raju Cook',
        role: 'staff',
        hostelId: 'A',
      },
    });

    jest.mocked(updateComplaintStatus).mockResolvedValue({
      id: 'complaint-001',
      student_id: 'demo-student-1',
      student_name: 'Arjun Mehta',
      category: 'Hygiene',
      complaint_text: 'Need a cleaner dining hall.',
      description: 'Need a cleaner dining hall.',
      status: 'resolved',
      created_at: '2026-05-22T08:00:00.000Z',
      updated_at: '2026-05-22T09:00:00.000Z',
    });

    const request = new Request('http://localhost/api/complaints/complaint-001', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'complaint-001' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateComplaintStatus).toHaveBeenCalledWith('complaint-001', 'resolved');
    expect(body.row.status).toBe('resolved');
  });
});
