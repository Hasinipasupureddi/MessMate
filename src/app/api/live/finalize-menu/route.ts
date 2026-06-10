import { NextResponse } from 'next/server';
import { getIstDateString, getIstNow } from '@/lib/utils/mealStatus';
import { getVotes } from '@/lib/api/mealVotesMySQL';
import { generateAndSaveFinalMenu, getFinalMenuRows, hydrateFinalMenuDay, saveFinalMenu, saveMenuRotation } from '@/lib/api/finalMenuMySQL';
import { createGlobalNotification } from '@/lib/api/notificationsMySQL';
import { requireRole } from '@/lib/auth/guards';
import { emitRealtimeEvent, SOCKET_EVENTS } from '@/lib/socket/bridge';
import { getVoteBlueprintsForDate } from '@/lib/menu/votingBlueprints';
import { getOptionById } from '@/lib/api/voteOptionsMySQL';
import type { VoteAggregateRow } from '@/lib/menu/finalMenu';

export async function POST(request: Request) {
  const auth = await requireRole(request, ['staff', 'warden']);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const tomorrow = getIstDateString(1);
    
    const currentMenuRows = await getFinalMenuRows(tomorrow);
    const currentMenu = currentMenuRows.length > 0 ? hydrateFinalMenuDay(tomorrow, currentMenuRows) : null;

    const votesResultRaw = await getVotes(tomorrow);
    const votesResult = votesResultRaw as {
      rows: VoteAggregateRow[];
      totalStudents: number;
      totalUniqueVoters: number;
      participation: any;
    };
    const rows = votesResult.rows;

    // Always build the latest menu from current vote totals and save it as a draft for warden approval.
    let menu = await generateAndSaveFinalMenu(tomorrow, rows, 'awaiting_approval');

    // Preserve explicit staff override meals when finalizing.
    if (currentMenu) {
      menu = {
        ...menu,
        meals: menu.meals.map((meal) => {
          const existingMeal = currentMenu.meals.find((m) => m.mealType === meal.mealType);
          if (!existingMeal || existingMeal.winnerSource !== 'staff_override') {
            return meal;
          }
          return {
            ...meal,
            winningItems: existingMeal.winningItems,
            winnerSource: 'staff_override',
            overrideReason: existingMeal.overrideReason,
          };
        }),
      };
    }

    await saveFinalMenu(menu, 'awaiting_approval');

    return NextResponse.json({ success: true, menu });
  } catch (error) {
    console.error('Finalize menu error:', error);
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}
export async function PATCH(request: Request) {
  const auth = await requireRole(request, ['staff', 'warden']);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const tomorrow = getIstDateString(1);
    const body = await request.json();
    const action = String(body?.action ?? '').trim();

    if (action === 'reset') {
      const votesResultRaw = await getVotes(tomorrow);
      const votesResult = votesResultRaw as {
        rows: VoteAggregateRow[];
        totalStudents: number;
        totalUniqueVoters: number;
        participation: any;
      };
      const menu = await generateAndSaveFinalMenu(tomorrow, votesResult.rows, 'awaiting_approval');
      return NextResponse.json({ success: true, menu });
    }

    const mealType = String(body?.mealType ?? '').trim() as any;
    const selectedOptionIds: string[] = Array.isArray(body?.selectedOptionIds)
      ? body.selectedOptionIds.map((id: unknown) => String(id).trim()).filter(Boolean)
      : String(body?.selectedOptionId ?? '').trim()
      ? [String(body.selectedOptionId).trim()]
      : [];
    const reason = String(body?.reason ?? '').trim() || null;

    if (!mealType || selectedOptionIds.length === 0) {
      return NextResponse.json({ message: 'mealType and selectedOptionIds are required.' }, { status: 400 });
    }

    const votesResultRaw = await getVotes(tomorrow);
    const votesResult = votesResultRaw as {
      rows: VoteAggregateRow[];
      totalStudents: number;
      totalUniqueVoters: number;
      participation: any;
    };

    const currentMenuRows = await getFinalMenuRows(tomorrow);
    let menu = currentMenuRows.length > 0
      ? hydrateFinalMenuDay(tomorrow, currentMenuRows)
      : await generateAndSaveFinalMenu(tomorrow, votesResult.rows, 'awaiting_approval');

    const dateObj = new Date(`${tomorrow}T00:00:00.000Z`);
    const blueprint = getVoteBlueprintsForDate(dateObj).find(b => b.mealType === mealType);
    const selectedOptions = selectedOptionIds.map((optionId: string) => {
      const option = getOptionById(optionId) ?? blueprint?.options.find((o) => o.id === optionId);
      if (!option) {
        throw new Error(`Selected option ${optionId} not found for meal ${mealType}.`);
      }
      return option;
    });

    const selectedOptionSet = new Set(selectedOptionIds);
    const currentMeal = menu.meals.find((meal) => meal.mealType === mealType);
    const preservedItems = currentMeal?.winningItems.filter((item) => {
      return (
        !selectedOptionSet.has(item.selectedOptionId) &&
        !selectedOptions.some((selectedOption: any) => selectedOption.categoryKey === item.categoryKey)
      );
    }) ?? [];

    const newItems = selectedOptions.map((selectedOption: any) => {
      const voteEntry = votesResult.rows.find(
        (r) => r.mealType === mealType && r.menuOption === selectedOption.id
      );
      return {
        label: selectedOption.label,
        emoji: selectedOption.emoji,
        items: [...selectedOption.items],
        selectedOptionId: selectedOption.id,
        votes: voteEntry?.votes ?? 0,
        dietPreference: selectedOption.dietPreference || 'both',
        categoryKey: selectedOption.categoryKey ?? selectedOption.category ?? 'main',
      };
    });

    const categoryOrder = blueprint?.categories.map((category) => category.id) ?? [];
    const winningItems = [...newItems, ...preservedItems].sort((left, right) => {
      const leftIndex = categoryOrder.indexOf(left.categoryKey ?? '');
      const rightIndex = categoryOrder.indexOf(right.categoryKey ?? '');
      if (leftIndex !== rightIndex) {
        if (leftIndex === -1) return 1;
        if (rightIndex === -1) return -1;
        return leftIndex - rightIndex;
      }
      return left.label.localeCompare(right.label);
    });

    menu = {
      ...menu,
      meals: menu.meals.map((meal) => {
        if (meal.mealType !== mealType) return meal;

        return {
          ...meal,
          winningItems,
          winnerSource: 'staff_override',
          overrideReason: reason,
        };
      }),
    };

    await saveFinalMenu(menu, 'awaiting_approval');

    return NextResponse.json({ success: true, menu });
  } catch (error) {
    console.error('Finalize menu override error:', error);
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}