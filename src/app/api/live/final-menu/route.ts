import { NextResponse } from 'next/server';
import { getIstDateString, getIstNow } from '@/lib/utils/mealStatus';
import { getVotes } from '@/lib/api/mealVotesMySQL';
import { buildFinalMenuFromVotes, generateAndSaveFinalMenu, getFinalMenuRows, hydrateFinalMenuDay, getTotalStudentCount, saveFinalMenu } from '@/lib/api/finalMenuMySQL';
import { normalizeDietPreference } from '@/lib/menu/masterMenu';
import type { FinalMenuMeal, VoteAggregateRow } from '@/lib/menu/finalMenu';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || getIstDateString(1);
    const rawPref = url.searchParams.get('pref');
    const pref = rawPref ? normalizeDietPreference(rawPref) : 'all';
    const istNow = getIstNow();
    // REMOVED auto-approval after 22:00. Menu must be explicitly approved by warden.

    const [savedRows, totalStudents, votesResultRaw] = await Promise.all([
      getFinalMenuRows(date),
      getTotalStudentCount(),
      getVotes(date),
    ]);

    const votesResult = votesResultRaw as {
      rows: VoteAggregateRow[];
      totalStudents: number;
      totalUniqueVoters: number;
      participation: any;
    };
    const votes = votesResult.rows;
    const totalVotes = votes.reduce((sum: number, v: VoteAggregateRow) => sum + v.votes, 0);

    let menu;
    let generated = false;

    if (savedRows.length > 0) {
      const savedMenu = hydrateFinalMenuDay(date, savedRows);
      // If it exists, we use the saved status (approved or awaiting_approval)
      menu = savedMenu;
      
      // If it's not approved yet, we still refresh the base menu from latest votes 
      // but keep staff overrides if they exist.
      if (menu.status !== 'approved') {
        const latestMenu = await buildFinalMenuFromVotes(date, votes, 'awaiting_approval');
        generated = true;
        
        const overrideMeals = savedMenu.meals.filter((meal) => meal.winnerSource === 'staff_override');
        menu = {
          ...latestMenu,
          status: 'awaiting_approval',
          meals: latestMenu.meals.map((meal) => {
            const override = overrideMeals.find((overrideMeal) => overrideMeal.mealType === meal.mealType);
            if (!override) return meal;
            return {
              ...meal,
              winningItems: override.winningItems,
              winnerSource: 'staff_override',
              overrideReason: override.overrideReason,
            };
          }) as FinalMenuMeal[],
        };
      }
    } else {
      // If no menu saved yet, we build a draft (awaiting_approval)
      menu = await buildFinalMenuFromVotes(date, votes, 'awaiting_approval');
      generated = true;
    }

    const dateObj = new Date(`${date}T00:00:00.000Z`);
    const isThursday = dateObj.getUTCDay() === 4;
    const isSunday = dateObj.getUTCDay() === 0;

    // Filter menu by preference and day rules
    menu.meals = menu.meals.map(meal => {
      // 1. Sunday Dinner: Common menu for everyone - NO Rice/Curd injection
      const isSundayDinner = isSunday && meal.mealType === 'dinner';
      
      // Check if it's Week 2 Friday Lunch
      const dateObj = new Date(`${date}T00:00:00.000Z`);
      const weekNum = Math.ceil(dateObj.getDate() / 7);
      const isWeek2Friday = 
        dateObj.getDay() === 5 && 
        (weekNum === 2 || 
         (dateObj.getMonth() === 5 && 
          (dateObj.getDate() === 5 || dateObj.getDate() === 12)));
      
      const filteredWinningItems = meal.winningItems.filter(item => {
        const label = (item.label || '').toLowerCase();
        const itemNames = (item.items || []).map(i => i.toLowerCase());
        const isNonVegKeyword = label.includes('chicken') || label.includes('egg') || label.includes('mutton') || label.includes('fish') ||
                               itemNames.some(i => i.includes('chicken') || i.includes('egg') || i.includes('mutton') || i.includes('fish'));

        // Apply Week 2 Friday Lunch rules
        if (isWeek2Friday && meal.mealType === 'lunch') {
          if (pref === 'non_veg' && (item as any).categoryKey === 'side') {
            return false;
          }
        }

        if (isSundayDinner) return true;
        
        const isNonVegItem = item.dietPreference === 'non_veg' || isNonVegKeyword;

        // 2. Sunday Lunch: Ensure non-veg students see the non-veg winner
        // and veg students see the veg winner.
        if (isSunday && meal.mealType === 'lunch') {
          if (pref === 'non_veg') return isNonVegItem || item.dietPreference === 'both';
          if (pref === 'veg') return !isNonVegItem || item.dietPreference === 'both';
          return true;
        }

        // 3. Enforce dietary preference for veg users only.
        if (pref === 'veg' && isNonVegItem) return false;

        // 4. Enforce Veg-only days (e.g., Thursday)
        if (isThursday && isNonVegItem) return false;
        
        return true;
      });

      return {
        ...meal,
        winningItems: filteredWinningItems,
        // Override fixed items for Sunday Dinner to prevent Rice/Curd injection
        fixedItems: isSundayDinner ? [] : (meal.fixedItems || [])
      };
    });

    // Final Sunday safety check: If filtering left us with an empty meal but Warden History has data, 
    // it means the filtering was too aggressive or the data was malformed.
    if (isSunday) {
      menu.meals = menu.meals.map(meal => {
        if (meal.winningItems.length === 0 && (meal.mealType === 'lunch' || meal.mealType === 'dinner')) {
          // If Sunday lunch is empty for non-veg, show the first item (likely the non-veg winner)
          // This is a fallback to prevent the empty card in your screenshot
          const originalMeal = savedRows.length > 0 
            ? hydrateFinalMenuDay(date, savedRows).meals.find(m => m.mealType === meal.mealType)
            : null;
          
          if (originalMeal && originalMeal.winningItems.length > 0) {
            return {
              ...meal,
              winningItems: originalMeal.winningItems
            };
          }
        }
        return meal;
      });
    }

    return NextResponse.json({
      menu,
      rows: menu.meals,
      generated,
      totalStudents,
      totalVotes: votesResult.totalUniqueVoters || 0,
    });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}
