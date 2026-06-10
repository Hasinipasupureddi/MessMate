import { getIstNow } from '@/lib/utils/mealStatus';
import type { VoteBlueprint, VoteMealType } from './votingBlueprints';
import { getDefaultBlueprintForMeal, getVoteBlueprintForMeal, getVoteBlueprintsForDate } from './votingBlueprints';
import { SUNDAY_LUNCH_W1 } from './sundayCatalog';

export type VoteAggregateRow = {
  mealType: VoteMealType;
  categoryKey: string;
  menuOption: string;
  option: string;
  votes: number;
};

export type FinalMenuItem = {
  label: string;
  emoji: string;
  items: string[];
  selectedOptionId: string;
  votes: number;
  dietPreference?: 'veg' | 'non_veg' | 'both';
  categoryKey?: string;
};

export type FinalMenuMeal = {
  mealType: VoteMealType;
  title: string;
  subtitle: string;
  fixedItems: string[];
  winningItems: FinalMenuItem[];
  fallbackOptionIds: string[];
  winnerSource?: 'votes' | 'staff_override';
  overrideReason?: string | null;
};

export type FinalMenuDay = {
  dateKey: string;
  dayName: string;
  dayShort: string;
  meals: FinalMenuMeal[];
  status?: 'awaiting_approval' | 'approved';
  generatedAt?: string | null;
};

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDayNames(date: Date) {
  return {
    dayName: date.toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'UTC' }),
    dayShort: date.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' }),
  };
}

function buildVoteMap(votes: VoteAggregateRow[]) {
  const map = new Map<VoteMealType, Map<string, VoteAggregateRow>>();

  for (const row of votes) {
    if (!map.has(row.mealType)) {
      map.set(row.mealType, new Map<string, VoteAggregateRow>());
    }
    const mealMap = map.get(row.mealType)!;
    const existing = mealMap.get(row.menuOption);
    if (existing) {
      existing.votes += row.votes;
    } else {
      mealMap.set(row.menuOption, { ...row });
    }
  }

  return map;
}

export type RatingAggregateMap = Map<string, { avg_rating: number; rating_count: number }>;

function rankOptions(
  blueprint: VoteBlueprint,
  _categoryKey: string,
  voteRows: Map<string, VoteAggregateRow>,
  ratingMap: RatingAggregateMap = new Map(),
  options: typeof blueprint.options = blueprint.options,
  rotationMap: Map<string, string | null> = new Map()
) {
  return options
    .map((option) => ({
      option,
      votes: voteRows.get(option.id)?.votes ?? 0,
      rating: ratingMap.get(option.label) ?? { avg_rating: 0, rating_count: 0 },
      lastServed: rotationMap.get(option.id) ?? null,
    }))
    .sort((left, right) => {
      // 1. Highest votes win
      if (right.votes !== left.votes) {
        return right.votes - left.votes;
      }

      // 2. Choose item not served recently (older lastServedDate or null/never served first)
      if (left.lastServed === null && right.lastServed !== null) return -1;
      if (left.lastServed !== null && right.lastServed === null) return 1;
      if (left.lastServed !== null && right.lastServed !== null) {
        if (left.lastServed !== right.lastServed) {
          return left.lastServed.localeCompare(right.lastServed);
        }
      }

      // 3. Higher rated dish wins ties
      if (right.rating.avg_rating !== left.rating.avg_rating) {
        return right.rating.avg_rating - left.rating.avg_rating;
      }

      // 4. Special Default Menu wins ties
      if (left.option.isDefault && !right.option.isDefault) return -1;
      if (!left.option.isDefault && right.option.isDefault) return 1;

      // 5. Blueprint order wins (alphabetical fallback)
      return left.option.label.localeCompare(right.option.label);
    });
}

function getSelectedOptions(
  blueprint: VoteBlueprint,
  voteMap: Map<string, Map<string, VoteAggregateRow>>,
  ratingMap: RatingAggregateMap = new Map(),
  rotationMap: Map<string, string | null> = new Map()
) {
  const winners: any[] = [];
  const mealVotes = voteMap.get(blueprint.mealType) ?? new Map();

  for (const category of blueprint.categories) {
    const categoryOptions = blueprint.options.filter((o) => {
      const optionCategoryKey = (o as any).categoryKey as string | undefined;
      if (optionCategoryKey) {
        return optionCategoryKey === category.id;
      }
      if (o.category === category.type) {
        return true;
      }
      if (category.id === 'main' && o.category === 'main') {
        return true;
      }
      return false;
    });

    const catVotes = new Map<string, VoteAggregateRow>();
    for (const option of categoryOptions) {
      const row = mealVotes.get(option.id);
      if (row) {
        catVotes.set(option.id, row);
      }
    }

    const ranked = rankOptions(
      blueprint,
      category.id,
      catVotes,
      ratingMap,
      categoryOptions,
      rotationMap
    ).map((entry) => ({ ...entry, categoryKey: category.id }));

    const maxSelections = category.maxSelections ?? 1;
    if (maxSelections > 1) {
      const topN = ranked.slice(0, maxSelections);
      winners.push(...topN);
    } else {
      if (ranked.length > 0) {
        winners.push(ranked[0]);
      }
    }
  }

  return winners;
}

function buildMeal(
  blueprint: VoteBlueprint,
  voteMap: Map<string, Map<string, VoteAggregateRow>>,
  ratingMap: RatingAggregateMap,
  _totalStudents: number,
  rotationMap: Map<string, string | null> = new Map()
): FinalMenuMeal {
  const winners = getSelectedOptions(blueprint, voteMap, ratingMap, rotationMap);

  let fixedItems = [...blueprint.fixedItems];
  
  // Rule: On Pani Puri snack day → No tea/milk during snack service
  const isPaniPuriDay = winners.some(w => w.option.label === 'Pani Puri' || w.option.id === 'S36');
  if (blueprint.mealType === 'snack' && isPaniPuriDay) {
    fixedItems = fixedItems.filter(item => item !== 'Tea' && item !== 'Milk');
  }

  // Rule: If a Pachadi is present in the winning menu items, then Pickle is unnecessary for Lunch
  const hasPachadi = winners.some(w => 
    w.option.category === 'pachadi' || 
    w.option.label.toLowerCase().includes('pachadi') ||
    w.option.items.some((item: string) => item.toLowerCase().includes('pachadi'))
  );
  if (blueprint.mealType === 'lunch' && hasPachadi) {
    fixedItems = fixedItems.filter(item => item !== 'Pickle');
  }

  return {
    mealType: blueprint.mealType,
    title: blueprint.title,
    subtitle: blueprint.subtitle,
    fixedItems,
    winningItems: winners.map((entry) => ({
      label: entry.option.label,
      emoji: entry.option.emoji,
      items: [...entry.option.items],
      selectedOptionId: entry.option.id,
      votes: entry.votes,
      dietPreference: entry.option.dietPreference,
      categoryKey: entry.categoryKey,
    })),
    fallbackOptionIds: blueprint.options.map((option) => option.id),
    winnerSource: 'votes',
    overrideReason: null,
  };
}

export function buildFinalMenuDay(
  date: Date = getIstNow(),
  votes: VoteAggregateRow[] = [],
  ratingMap: RatingAggregateMap = new Map(),
  totalStudents: number = 200,
  rotationMap: Map<string, string | null> = new Map(),
  dbOptions: any[] = []
): FinalMenuDay {
  const voteMap = buildVoteMap(votes);
  const blueprints = getVoteBlueprintsForDate(date);
  const { dayName, dayShort } = getDayNames(date);

  // If we have DB options, override the blueprint options to ensure sync
  const syncedBlueprints = blueprints.map(bp => {
    const mealDbOptions = dbOptions.filter(o => o.mealType === bp.mealType);
    if (mealDbOptions.length === 0) return bp;

    return {
      ...bp,
      options: mealDbOptions.map(o => ({
        id: o.id,
        label: o.label,
        emoji: o.emoji,
        items: o.items,
        category: o.category || 'main',
        categoryKey: o.categoryKey,
        dietPreference: o.dietPreference
      }))
    };
  });

  return {
    dateKey: getDateKey(date),
    dayName,
    dayShort,
    meals: syncedBlueprints.map((blueprint) =>
      buildMeal(
        blueprint,
        voteMap,
        ratingMap,
        totalStudents,
        rotationMap
      )
    ),
    status: 'awaiting_approval',
    generatedAt: new Date().toISOString(),
  };
}

export function getBlueprintForMeal(date: Date, mealType: VoteMealType) {
  return getVoteBlueprintForMeal(date, mealType) ?? getDefaultBlueprintForMeal(mealType);
}

export function getFinalMenuSummary(menu: FinalMenuDay) {
  return menu.meals.map((meal) => ({
    mealType: meal.mealType,
    fixedItems: meal.fixedItems,
    winningItems: meal.winningItems.flatMap((item) => item.items),
  }));
}

export function getSundayPreorderItems(menu: FinalMenuDay) {
  const sundayMeal = menu.meals.find((meal) => meal.mealType === 'lunch');
  return sundayMeal?.winningItems.flatMap((item) => item.items) ?? SUNDAY_LUNCH_W1[0].items;
}
