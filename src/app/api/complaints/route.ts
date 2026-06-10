import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import {
  createComplaint,
  listComplaintsForRole,
} from '@/lib/api/complaintsMySQL';
import { emitRealtimeEvent, SOCKET_EVENTS } from '@/lib/socket/bridge';

async function requireStaffOrWarden(request: Request, role: 'staff' | 'warden') {
  return requireRole(request, role === 'warden' ? ['warden'] : ['staff']);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const role = url.searchParams.get('role') === 'warden' ? 'warden' : 'staff';
  const auth = await requireStaffOrWarden(request, role);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const rows = await listComplaintsForRole(role);
    return NextResponse.json({
      rows: rows.map((row) => ({
        id: row.id,
        studentId: row.student_id,
        studentName: row.student_name,
        category: row.category,
        description: row.description ?? row.complaint_text,
        complaintText: row.complaint_text,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireRole(request, ['student']);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const category = String(body?.category ?? '').trim();
    const complaintText = String(body?.complaintText ?? '').trim();

    if (!category || !complaintText) {
      return NextResponse.json(
        { message: 'category and complaintText are required.' },
        { status: 400 }
      );
    }

    if (complaintText.length < 10) {
      return NextResponse.json(
        { message: 'complaintText must be at least 10 characters.' },
        { status: 400 }
      );
    }

    const complaint = await createComplaint({
      studentId: auth.session.sub,
      category,
      complaintText,
    });

    void emitRealtimeEvent(
      SOCKET_EVENTS.complaintCreated,
      {
        complaint: {
          id: complaint.id,
          studentId: complaint.student_id,
          studentName: complaint.student_name,
          category: complaint.category,
          description: complaint.description ?? complaint.complaint_text,
          complaintText: complaint.complaint_text,
          status: complaint.status,
          createdAt: complaint.created_at,
          updatedAt: complaint.updated_at,
        },
        studentId: complaint.student_id,
        rooms: [`user:${complaint.student_id}`],
        roles: ['staff', 'warden'],
        sender: {
          userId: auth.session.sub,
          role: auth.session.role,
          hostelId: auth.session.hostelId,
        },
      }
    );

    void emitRealtimeEvent(
      SOCKET_EVENTS.notificationsUpdated,
      {
        userId: complaint.student_id,
        message: 'Your complaint has been created.',
        severity: 'info',
      },
      {
        rooms: [`user:${complaint.student_id}`],
        sender: {
          userId: auth.session.sub,
          role: auth.session.role,
          hostelId: auth.session.hostelId,
        },
      }
    );

    void emitRealtimeEvent(
      SOCKET_EVENTS.analyticsRefresh,
      { reason: 'complaint-created' },
      {
        roles: ['staff', 'warden'],
        sender: {
          userId: auth.session.sub,
          role: auth.session.role,
          hostelId: auth.session.hostelId,
        },
      }
    );

    return NextResponse.json({
      row: {
        id: complaint.id,
        studentId: complaint.student_id,
        studentName: complaint.student_name,
        category: complaint.category,
        description: complaint.description ?? complaint.complaint_text,
        complaintText: complaint.complaint_text,
        status: complaint.status,
        createdAt: complaint.created_at,
        updatedAt: complaint.updated_at,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error).message || 'Failed to create complaint.' },
      { status: 500 }
    );
  }
}