import { NextResponse, NextRequest } from 'next/server';
import { calculateIngredientsFromCatalog, getShortageSummary, getSummaryByCategory } from '@/lib/api/ingredientCalculation';
import { requireRole } from '@/lib/auth/guards';
import { getIstDateString } from '@/lib/utils/mealStatus';
import { getVotes } from '@/lib/api/mealVotesMySQL';
import { buildFinalMenuFromVotes, getFinalMenuRows, hydrateFinalMenuDay } from '@/lib/api/finalMenuMySQL';
import type { VoteAggregateRow } from '@/lib/menu/finalMenu';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ['staff']);
    if (!auth.ok) return auth.response;
    const url = new URL(request.url);
    const headcount = parseInt(url.searchParams.get('headcount') || '210', 10);
    const buffer = parseInt(url.searchParams.get('buffer') || '10', 10);
    const date = url.searchParams.get('date') || getIstDateString(1);

    // Validate inputs
    if (isNaN(headcount) || headcount < 1 || headcount > 5000) {
      return NextResponse.json(
        { message: 'Invalid headcount. Must be between 1 and 5000.' },
        { status: 400 }
      );
    }

    if (isNaN(buffer) || buffer < -50 || buffer > 100) {
      return NextResponse.json(
        { message: 'Invalid buffer. Must be between -50 and 100.' },
        { status: 400 }
      );
    }

    // Load tomorrow's finalized menu so ingredient calculations use the actual menu basis.
    const [savedMenuRows, votesResultRaw] = await Promise.all([
      getFinalMenuRows(date),
      getVotes(date),
    ]);

    const votesResult = votesResultRaw as {
      rows: VoteAggregateRow[];
      totalStudents: number;
      totalUniqueVoters: number;
      participation: any;
    };

    const isApproved = savedMenuRows.length > 0 && savedMenuRows.every(r => r.status === 'approved');
    const istNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const isAfterVotingDeadline = istNow.getHours() >= 22 || date !== getIstDateString(1);

    let menu;
    if (isApproved || (savedMenuRows.length > 0 && isAfterVotingDeadline)) {
      menu = hydrateFinalMenuDay(date, savedMenuRows);
    } else {
      menu = await buildFinalMenuFromVotes(date, votesResult.rows, 'awaiting_approval');
    }

    const activeDishes = menu.meals.flatMap(m => [
      ...m.fixedItems,
      ...m.winningItems.flatMap(w => w.items && w.items.length > 0 ? w.items : [w.label]),
    ]).map(d => d.toLowerCase());

    const normalizedDishTexts = activeDishes
      .map((dish) => dish.replace(/[^a-z0-9 ]+/g, ' ').trim().toLowerCase());

    const normalizedDishTerms = normalizedDishTexts
      .flatMap((dish) => dish.split(' ').filter(Boolean));

    const normalizedDishText = normalizedDishTexts.join(' ');

    const catalog = await (await import('@/lib/api/ingredientCatalogMySQL')).listIngredientCatalog();

    const ingredientMatchers: Record<string, string[]> = {
      'ing-rice': ['rice', 'pulav', 'pulao', 'idli', 'dosa', 'bath', 'biriyani', 'biryani'],
      'ing-dal': ['dal', 'pappu', 'sambar', 'rasam', 'pulusu', 'charu'],
      'ing-tomato': ['tomato', 'sambar', 'rasam', 'curry', 'pachadi', 'charu'],
      'ing-onion': ['onion', 'sambar', 'kurma', 'curry', 'gravy', 'fried', 'noodles', 'pappu'],
      'ing-potato': ['potato', 'aloo', 'fry', 'sabzi', 'curry'],
      'ing-oil': ['poori', 'dosa', 'vada', 'fry', 'curry', 'kurma', 'sambar', 'dal', 'pulusu', 'pappu', 'pachadi'],
      'ing-curd': ['curd', 'raita', 'lassi', 'pachadi'],
      'ing-tamarind': ['tamarind', 'sambar', 'rasam', 'pulusu', 'pachadi', 'charu'],
      'ing-idly-batter': ['idli', 'dosa', 'uttapam', 'vada', 'bath'],
      'ing-coconut': ['coconut', 'kobbari', 'coconut chutney', 'kobbari chutney'],
      'ing-wheat-flour': ['poori', 'chapati', 'roti', 'paratha'],
    };

    const matchesIngredient = (ingredientId: string) => {
      const patterns = ingredientMatchers[ingredientId] ?? [];
      return patterns.some((pattern) => {
        if (pattern.includes(' ')) {
          return normalizedDishText.includes(pattern);
        }
        return normalizedDishTerms.includes(pattern);
      });
    };

    let filteredCatalog = catalog;
    if (activeDishes.length > 0) {
      filteredCatalog = catalog.filter(item => matchesIngredient(item.id));
      if (filteredCatalog.length === 0) {
        filteredCatalog = catalog;
      }
    }

    const ingredients = calculateIngredientsFromCatalog(filteredCatalog, headcount, buffer);
    const shortage = getShortageSummary(ingredients);
    const summary = getSummaryByCategory(ingredients);
    const effectiveCount = Math.ceil(headcount * (1 + buffer / 100));

    return NextResponse.json({
      calculation: {
        headcount,
        bufferPercent: buffer,
        effectiveHeadcount: effectiveCount,
      },
      ingredients,
      shortage,
      summary,
    });
  } catch (error) {
    console.error('[ingredients-calculate GET]', error);
    return NextResponse.json(
      { message: (error as Error).message || 'Failed to calculate ingredients' },
      { status: 500 }
    );
  }
}
