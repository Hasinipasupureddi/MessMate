import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import {
  normalizeComplaintStatus,
  updateComplaintStatus,
} from '@/lib/api/complaintsMySQL';
import { emitRealtimeEvent, SOCKET_EVENTS } from '@/lib/socket/bridge';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(request, ['staff', 'warden']);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const status = normalizeComplaintStatus(String(body?.status ?? ''));

    if (status === 'open') {
      return NextResponse.json(
        { message: 'Complaint status can only be updated to in-progress or resolved.' },
        { status: 400 }
      );
    }

    const row = await updateComplaintStatus(id, status);

    void emitRealtimeEvent(
      SOCKET_EVENTS.complaintUpdated,
      {
        complaint: {
          id: row.id,
          studentId: row.student_id,
          studentName: row.student_name,
          category: row.category,
          description: row.description ?? row.complaint_text,
          complaintText: row.complaint_text,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
        studentId: row.student_id,
      },
      { rooms: [`user:${row.student_id}`], roles: ['staff', 'warden'] }
    );

    void emitRealtimeEvent(
      SOCKET_EVENTS.notificationsUpdated,
      {
        userId: row.student_id,
        message: `Your complaint status changed to ${row.status}.`,
        severity: 'info',
      },
      { rooms: [`user:${row.student_id}`] }
    );

    void emitRealtimeEvent(SOCKET_EVENTS.analyticsRefresh, { reason: 'complaint-updated' }, { roles: ['staff', 'warden'] });

    return NextResponse.json({
      row: {
        id: row.id,
        studentId: row.student_id,
        studentName: row.student_name,
        category: row.category,
        description: row.description ?? row.complaint_text,
        complaintText: row.complaint_text,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}