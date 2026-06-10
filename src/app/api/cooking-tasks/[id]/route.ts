import { NextResponse, NextRequest } from 'next/server';
import { updateCookingTaskStatus, getCookingTask, uiCookingStatus, updateCookingTask } from '@/lib/api/cookingTasksMySQL';
import { requireRole } from '@/lib/auth/guards';

type RouteParams = {
  id: string;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
) {
  try {
    const auth = await requireRole(request, ['staff']);
    if (!auth.ok) return auth.response;
    const { id } = await context.params;
    const body = await request.json();

    // Check if at least one valid field is provided
    if (!body.status && !body.assignedTo) {
      return NextResponse.json(
        { message: 'At least one of status or assignedTo field is required' },
        { status: 400 }
      );
    }

    let task;
    if (body.status && body.assignedTo) {
      // Update both fields
      task = await updateCookingTask(id, { status: body.status, assignedTo: body.assignedTo });
    } else if (body.status) {
      // Update only status
      task = await updateCookingTaskStatus(id, body.status);
    } else {
      // Update only assignedTo
      task = await updateCookingTask(id, { assignedTo: body.assignedTo });
    }

    const formatted = {
      id: task.id,
      taskDate: task.task_date,
      mealType: task.meal_type,
      taskName: task.task_name,
      status: uiCookingStatus(task.status),
      assignedTo: task.assigned_to || 'Unassigned',
      portions: task.portions,
      notes: task.notes,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
    };

    return NextResponse.json({ row: formatted });
  } catch (error) {
    console.error('[cooking-tasks PATCH]', error);
    return NextResponse.json(
      { message: (error as Error).message || 'Failed to update cooking task' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
) {
  try {
    const auth = await requireRole(request, ['staff', 'warden']);
    if (!auth.ok) return auth.response;
    const { id } = await context.params;

    const task = await getCookingTask(id);
    if (!task) {
      return NextResponse.json(
        { message: 'Cooking task not found' },
        { status: 404 }
      );
    }

    const formatted = {
      id: task.id,
      taskDate: task.task_date,
      mealType: task.meal_type,
      taskName: task.task_name,
      status: uiCookingStatus(task.status),
      createdAt: task.created_at,
      updatedAt: task.updated_at,
    };

    return NextResponse.json({ row: formatted });
  } catch (error) {
    console.error('[cooking-tasks GET by ID]', error);
    return NextResponse.json(
      { message: (error as Error).message || 'Failed to fetch cooking task' },
      { status: 500 }
    );
  }
}
