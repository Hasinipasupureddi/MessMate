import { NextResponse, NextRequest } from 'next/server';
import { getCookingTasksByDate, createCookingTask, uiCookingStatus } from '@/lib/api/cookingTasksMySQL';
import { requireRole } from '@/lib/auth/guards';
import { getIstDateString } from '@/lib/utils/mealStatus';
import { getFinalMenuRows, hydrateFinalMenuDay, getTotalStudentCount, generateAndSaveFinalMenu } from '@/lib/api/finalMenuMySQL';
import { getMealCountsByDate } from '@/lib/api/mealOptinsMySQL';
import { getVotes } from '@/lib/api/mealVotesMySQL';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ['staff', 'warden']);
    if (!auth.ok) return auth.response;
    const url = new URL(request.url);
    const taskDate = url.searchParams.get('date') || getIstDateString();

    let rows = await getCookingTasksByDate(taskDate);

    if (rows.length === 0) {
      let savedMenuRows = await getFinalMenuRows(taskDate);
      
      // Auto-generate menu if it wasn't finalized yet
      if (savedMenuRows.length === 0) {
        const votesRaw = await getVotes(taskDate);
        await generateAndSaveFinalMenu(taskDate, (votesRaw as any).rows, 'approved');
        savedMenuRows = await getFinalMenuRows(taskDate);
      }

      // Dynamically generate tasks from finalized menu if we have one
      if (savedMenuRows.length > 0) {
        const menu = hydrateFinalMenuDay(taskDate, savedMenuRows);
        const optinCounts = await getMealCountsByDate(taskDate);
        const totalStudents = await getTotalStudentCount();
        
        const chefs = ['Raju Kumar', 'Lakshmi Devi', 'Murugan S.'];
        let chefIdx = 0;

        for (const meal of menu.meals) {
          const matchedOptin = optinCounts.find((o: any) => o.meal_type === meal.mealType);
          const confirmed = matchedOptin ? Number(matchedOptin.confirmed || 0) : 0;
          const portions = confirmed || totalStudents || 7;

          // Gather dishes
          const dishes: string[] = [];
          for (const item of meal.winningItems) {
            if (item.items && item.items.length > 0) {
              dishes.push(...item.items);
            } else {
              dishes.push(item.label);
            }
          }
          dishes.push(...meal.fixedItems);

          for (const dish of dishes) {
            const assignedTo = chefs[chefIdx % chefs.length];
            chefIdx++;

            // Prevent duplicate tasks by checking DB directly (fixes concurrent request race conditions)
            const currentTasks = await getCookingTasksByDate(taskDate);
            const existingTask = currentTasks.find(r => r.meal_type === meal.mealType && r.task_name === dish);
            
            if (!existingTask) {
              await createCookingTask({
                taskDate,
                mealType: meal.mealType,
                taskName: dish,
                status: 'pending',
                assignedTo,
                portions,
                notes: meal.winningItems.some(item => (item.label || '').includes(dish)) ? 'Voted #1 today' : undefined,
              });
            }
          }
        }
        // Refetch rows
        rows = await getCookingTasksByDate(taskDate);
      }
    }

    // Convert to UI format with derived display helper properties
    const formatted = rows.map(row => {
      const portions = row.portions || 0;
      const dishLower = (row.task_name || '').toLowerCase();
      let quantity = '—';
      if (dishLower.includes('rice') || dishLower.includes('biryani')) {
        const val = portions * 0.3;
        quantity = `${val < 1 ? val.toFixed(1) : Math.round(val)} kg`;
      } else if (dishLower.includes('curry') || dishLower.includes('kurma') || dishLower.includes('dal') || dishLower.includes('sambar') || dishLower.includes('rasam') || dishLower.includes('gravy')) {
        const val = portions * 0.15;
        quantity = `${val < 1 ? val.toFixed(1) : Math.round(val)} L`;
      } else if (dishLower.includes('idly') || dishLower.includes('poori') || dishLower.includes('dosa') || dishLower.includes('chapati') || dishLower.includes('roti') || dishLower.includes('vada')) {
        quantity = `${Math.round(portions * 3.5)} pcs`;
      } else if (dishLower.includes('tea') || dishLower.includes('coffee') || dishLower.includes('milk')) {
        const val = portions * 0.15;
        quantity = `${val < 1 ? val.toFixed(1) : Math.round(val)} L`;
      } else if (dishLower.includes('biscuit') || dishLower.includes('snack') || dishLower.includes('banana') || dishLower.includes('egg')) {
        quantity = `${portions} pcs`;
      }

      let startTime = '—';
      if (row.meal_type === 'breakfast') startTime = '5:30 AM';
      else if (row.meal_type === 'lunch') startTime = '10:30 AM';
      else if (row.meal_type === 'snack') startTime = '3:30 PM';
      else if (row.meal_type === 'dinner') startTime = '5:30 PM';

      return {
        id: row.id,
        taskDate: row.task_date,
        mealType: row.meal_type,
        taskName: row.task_name,
        status: uiCookingStatus(row.status),
        assignedTo: row.assigned_to || 'Unassigned',
        portions,
        notes: row.notes,
        quantity,
        startTime,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    return NextResponse.json({ rows: formatted });
  } catch (error) {
    console.error('[cooking-tasks GET]', error);
    return NextResponse.json(
      { message: (error as Error).message || 'Failed to fetch cooking tasks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(request, ['staff']);
    if (!auth.ok) return auth.response;
    const body = await request.json();

    const task = await createCookingTask({
      taskId: body.taskId,
      taskDate: body.taskDate || getIstDateString(),
      mealType: body.mealType,
      taskName: body.taskName,
      status: body.status || 'pending',
      assignedTo: body.assignedTo,
      portions: body.portions,
      notes: body.notes,
    });

    const formatted = {
      id: task.id,
      taskDate: task.task_date,
      mealType: task.meal_type,
      taskName: task.task_name,
      status: uiCookingStatus(task.status),
      assignedTo: task.assigned_to,
      portions: task.portions,
      notes: task.notes,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
    };

    return NextResponse.json({ row: formatted }, { status: 201 });
  } catch (error) {
    console.error('[cooking-tasks POST]', error);
    return NextResponse.json(
      { message: (error as Error).message || 'Failed to create cooking task' },
      { status: 500 }
    );
  }
}
