import { NextResponse } from 'next/server';
import { getIstDateString } from '@/lib/utils/mealStatus';
import { getVotes } from '@/lib/api/mealVotesMySQL';
import {
  buildFinalMenuFromVotes,
  generateAndSaveFinalMenu,
  getFinalMenuRows,
  hydrateFinalMenuDay,
  saveFinalMenu,
  saveMenuRotation,
} from '@/lib/api/finalMenuMySQL';
import type { VoteAggregateRow } from '@/lib/menu/finalMenu';
import { requireRole } from '@/lib/auth/guards';
import { createGlobalNotification } from '@/lib/api/notificationsMySQL';
import { emitRealtimeEvent, SOCKET_EVENTS } from '@/lib/socket/bridge';
import { getLatestWardenMenuFeedback, saveWardenMenuFeedback } from '@/lib/api/menuFeedbackMySQL';

type VoteResult = {
  rows: VoteAggregateRow[];
  totalStudents: number;
  totalUniqueVoters: number;
  participation: any;
};

async function approveFinalMenu(menuDate: string) {
  const currentMenuRows = await getFinalMenuRows(menuDate);
  const votesResultRaw = await getVotes(menuDate);
  const votesResult = votesResultRaw as VoteResult;
  let menu;

  if (currentMenuRows.length > 0) {
    menu = hydrateFinalMenuDay(menuDate, currentMenuRows);
    if (menu.status === 'approved') {
      return { alreadyApproved: true, menu };
    }

    await saveFinalMenu(menu, 'approved');
    menu.status = 'approved';
  } else {
    menu = await generateAndSaveFinalMenu(menuDate, votesResult.rows, 'approved');
  }

  await saveMenuRotation(menu);

  const summary = menu.meals
    .map((meal: any) => {
      const winner = meal.winningItems[0]?.label || 'TBD';
      return `${meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1)}: ${winner}`;
    })
    .join('\n');

  try {
    await createGlobalNotification({
      title: '🍽️ Menu Approved',
      message: `The warden has approved the menu for ${menuDate}.\n\n${summary}`,
      type: 'success',
    });
  } catch (notificationError) {
    console.warn('Menu approval notification failed:', notificationError);
  }

  try {
    void emitRealtimeEvent(
      SOCKET_EVENTS.dashboardRefresh,
      { reason: 'final-menu-approved', date: menuDate },
      { roles: ['student'] }
    );
    void emitRealtimeEvent(
      SOCKET_EVENTS.notificationsUpdated,
      { reason: 'final-menu-approved', date: menuDate },
      { roles: ['student'] }
    );
  } catch (socketError) {
    console.warn('Menu approval realtime emit failed:', socketError);
  }

  return { alreadyApproved: false, menu };
}

export async function GET(request: Request) {
  const auth = await requireRole(request, ['warden']);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const menuDate = url.searchParams.get('date') || getIstDateString(1);

  const savedRows = await getFinalMenuRows(menuDate);
  let menu;

  if (savedRows.length > 0) {
    menu = hydrateFinalMenuDay(menuDate, savedRows);
  } else {
    const votesResultRaw = await getVotes(menuDate);
    const votesResult = votesResultRaw as VoteResult;
    menu = await buildFinalMenuFromVotes(menuDate, votesResult.rows, 'awaiting_approval');
  }

  const feedback = await getLatestWardenMenuFeedback(menuDate);

  return NextResponse.json({ menu, feedback });
}

export async function PATCH(request: Request) {
  const auth = await requireRole(request, ['warden']);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const menuDate = url.searchParams.get('date') || getIstDateString(1);
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || url.searchParams.get('action') || 'approve').trim();

  if (action === 'approve') {
    try {
      const result = await approveFinalMenu(menuDate);
      if (result.alreadyApproved) {
        return NextResponse.json({ success: true, message: 'Menu is already approved.', menu: result.menu });
      }
      return NextResponse.json({ success: true, message: 'Menu approved.', menu: result.menu });
    } catch (error) {
      return NextResponse.json({ message: (error as Error).message }, { status: 500 });
    }
  }

  if (action === 'request_changes') {
    const comment = String(body?.comment || '').trim();
    const mealType = String(body?.mealType || '').trim() as 'breakfast' | 'lunch' | 'snack' | 'dinner' | '';

    if (!comment) {
      return NextResponse.json({ message: 'A comment or change request description is required.' }, { status: 400 });
    }

    const savedRows = await getFinalMenuRows(menuDate);
    if (savedRows.length > 0 && savedRows[0].status === 'approved') {
      return NextResponse.json({ message: 'Cannot request changes after the menu is already approved.' }, { status: 400 });
    }

    const feedback = await saveWardenMenuFeedback({
      menuDate,
      mealType: mealType || null,
      wardenId: auth.session.sub,
      action: 'request_changes',
      comment,
    });

    try {
      await createGlobalNotification({
        title: 'Menu change request',
        message: `The warden has requested changes for ${menuDate}.\n\n${comment}`,
        type: 'warning',
      });
    } catch (notificationError) {
      console.warn('Menu change request notification failed:', notificationError);
    }

    try {
      void emitRealtimeEvent(
        SOCKET_EVENTS.dashboardRefresh,
        { reason: 'menu-change-requested', date: menuDate },
        { roles: ['staff'] }
      );
      void emitRealtimeEvent(
        SOCKET_EVENTS.notificationsUpdated,
        { reason: 'menu-change-requested', date: menuDate },
        { roles: ['staff'] }
      );
    } catch (socketError) {
      console.warn('Menu change request realtime emit failed:', socketError);
    }

    return NextResponse.json({
      success: true,
      message: 'Menu feedback saved. Staff can revise the draft and resubmit when ready.',
      feedback: feedback ?? null,
    });
  }

  return NextResponse.json({ message: 'Invalid action.' }, { status: 400 });
}
