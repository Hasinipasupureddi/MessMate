/** @jest-environment node */

import { POST } from '@/app/api/complaints/route';
import { createComplaint } from '@/lib/api/complaintsMySQL';
import { requireRole } from '@/lib/auth/guards';

jest.mock('@/lib/api/complaintsMySQL', () => ({
  createComplaint: jest.fn(),
}));

jest.mock('@/lib/auth/guards', () => ({
  requireRole: jest.fn(),
}));

describe('Complaints API smoke coverage', () => {
  const mockedCreateComplaint = jest.mocked(createComplaint);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('creates a student complaint and returns the saved row', async () => {
    mockedCreateComplaint.mockResolvedValue({
      id: 'complaint-001',
      student_id: 'demo-student-1',
      category: 'Hygiene',
      complaint_text: 'The dining hall floor needs cleaning after lunch.',
      status: 'open',
      created_at: '2026-05-14T10:00:00.000Z',
      updated_at: '2026-05-14T10:00:00.000Z',
    });

    const request = new Request('http://localhost/api/complaints', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'messmate_session=fake-token',
      },
      body: JSON.stringify({ category: 'Hygiene', complaintText: 'The dining hall floor needs cleaning after lunch.' }),
    });

    jest.mocked(requireRole).mockResolvedValue({
      ok: true,
      session: {
        sub: 'demo-student-1',
        email: 'arjun.mehta@messmate.in',
        name: 'Arjun Mehta',
        role: 'student',
        hostelId: 'A',
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedCreateComplaint).toHaveBeenCalledWith({
      studentId: 'demo-student-1',
      category: 'Hygiene',
      complaintText: 'The dining hall floor needs cleaning after lunch.',
    });
    expect(body).toEqual({
      row: {
        id: 'complaint-001',
        studentId: 'demo-student-1',
        category: 'Hygiene',
        description: 'The dining hall floor needs cleaning after lunch.',
        complaintText: 'The dining hall floor needs cleaning after lunch.',
        status: 'open',
        createdAt: '2026-05-14T10:00:00.000Z',
        updatedAt: '2026-05-14T10:00:00.000Z',
      },
    });
  });
});