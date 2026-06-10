import { getIstNow } from '@/lib/utils/mealStatus';
import { readCachedGeneratedMenuDay } from './generatedMenuCache';
import { getDefaultBlueprintForMeal, getVoteBlueprintForMeal, type VoteMealType } from './votingBlueprints';
import { SUNDAY_LUNCH_W1 } from './sundayCatalog';

export type DietPreference = 'veg' | 'non_veg';
export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export type MenuMealCard = {
  id: string;
  label: string;
  mealType: MealType;
  emoji: string;
  time: string;
  items: string[];
  special?: string;
  deadline: string;
  attendees: number;
  capacity: number;
};

export type MenuDay = {
  dateKey: string;
  dayShort: string;
  dayName: string;
  dayOfMonth: string;
  isToday: boolean;
  meals: Record<MealType, MenuMealCard>;
};

type MealTiming = {
  time: string;
  deadline: string;
};

const WEEKDAY_SHORTS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

const MEAL_TIMINGS: Record<MealType, MealTiming> = {
  breakfast: { time: '7:30 AM – 8:30 AM', deadline: 'Opt-in by 7:00 AM' },
  lunch: { time: '12:00 PM – 1:00 PM', deadline: 'Opt-in by 11:30 AM' },
  snack: { time: '4:30 PM – 5:00 PM', deadline: 'Opt-in by 3:30 PM' },
  dinner: { time: '7:00 PM – 8:00 PM', deadline: 'Opt-in by 6:00 PM' },
};

const BASE_COUNTS: Record<MealType, number> = {
  breakfast: 187,
  lunch: 203,
  snack: 50,
  dinner: 0,
};

const FALLBACK_CAPACITY: Record<MealType, number> = {
  breakfast: 240,
  lunch: 240,
  snack: 100,
  dinner: 240,
};

function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sameCalendarDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function uniq(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function getBlueprintForMeal(date: Date, mealType: MealType) {
  const blueprint = getVoteBlueprintForMeal(date, mealType as VoteMealType);
  if (blueprint) {
    return blueprint;
  }

  return getDefaultBlueprintForMeal(mealType);
}

function getMenuItemsFromBlueprint(date: Date, mealType: MealType, diet: DietPreference = 'veg'): { items: string[]; special?: string } {
  const blueprint = getBlueprintForMeal(date, mealType);
  const cached = readCachedGeneratedMenuDay(getDateKey(date));
  const cachedMeal = cached?.meals.find((meal) => meal.mealType === mealType);
  const isThursday = date.getUTCDay() === 4;
  const isSunday = date.getUTCDay() === 0;

  if (cachedMeal) {
    const cachedItems = uniq([
      ...(isSunday && mealType === 'dinner' ? [] : cachedMeal.fixedItems),
      ...cachedMeal.winningItems
        .filter(item => {
          const label = (item.label || '').toLowerCase();
          const itemNames = (item.items || []).map(i => i.toLowerCase());
          const isNonVegKeyword = label.includes('chicken') || label.includes('egg') || label.includes('mutton') || label.includes('fish') ||
                                 itemNames.some(i => i.includes('chicken') || i.includes('egg') || i.includes('mutton') || i.includes('fish'));

          // 1. Sunday Dinner: Common menu for everyone
          if (isSunday && mealType === 'dinner') return true;

          // 2. Enforce dietary preference
          if (diet === 'veg' && (item.dietPreference === 'non_veg' || isNonVegKeyword)) return false;
          // 3. Enforce Veg-only days (e.g., Thursday)
          if (isThursday && (item.dietPreference === 'non_veg' || isNonVegKeyword)) return false;
          return true;
        })
        .flatMap((item) => item.items),
    ]);

    return {
      items: cachedItems,
      special: cachedMeal.subtitle,
    };
  }

  const fixedItems = isSunday && mealType === 'dinner' ? [] : blueprint.fixedItems;

  // Filter options by diet preference and day rules
  const filteredOptions = blueprint.options.filter(opt => {
    const label = (opt.label || '').toLowerCase();
    const itemNames = (opt.items || []).map(i => i.toLowerCase());
    const isNonVegKeyword = label.includes('chicken') || label.includes('egg') || label.includes('mutton') || label.includes('fish') ||
                           itemNames.some(i => i.includes('chicken') || i.includes('egg') || i.includes('mutton') || i.includes('fish'));

    if (isSunday && mealType === 'dinner') return true;
    if (diet === 'veg' && (opt.dietPreference === 'non_veg' || isNonVegKeyword)) return false;
    if (isThursday && (opt.dietPreference === 'non_veg' || isNonVegKeyword)) return false;
    return true;
  });

  const selected = filteredOptions[0] || blueprint.options[0];
  const winningItems = uniq(selected.items);

  let finalFixed = [...fixedItems];
  const hasPachadi = winningItems.some(item => item.toLowerCase().includes('pachadi'));
  if (mealType === 'lunch' && hasPachadi) {
    finalFixed = finalFixed.filter(item => item !== 'Pickle');
  }

  return {
    items: uniq([...finalFixed, ...winningItems]),
  };
}

function buildSundayLunchItems(date: Date): { items: string[]; special: string } {
  const selected = SUNDAY_LUNCH_W1[0];
  return {
    items: uniq(selected.items),
    special: 'Sunday Cheat Day',
  };
}

export function getDietPreferenceFromStorage(): DietPreference {
  if (typeof window === 'undefined') {
    return 'veg';
  }

  const stored = window.localStorage.getItem('messmate_diet');
  return normalizeDietPreference(stored);
}

export function normalizeDietPreference(value?: string | null): DietPreference {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '');

  if (normalized.includes('non') && normalized.includes('veg')) {
    return 'non_veg';
  }

  return 'veg';
}

export function getWeekStart(referenceDate = getIstNow()): Date {
  const weekStart = new Date(referenceDate);
  const offset = (referenceDate.getDay() + 6) % 7;
  weekStart.setDate(referenceDate.getDate() - offset);
  return weekStart;
}

export function isSpecialFriday(date: Date): boolean {
  return date.getDay() === 5 && Math.ceil(date.getDate() / 7) === 2;
}

export function isSpecialSunday(date: Date): boolean {
  return date.getDay() === 0 && Math.ceil(date.getDate() / 7) === 1;
}

export function getSnackForDate(date: Date): string {
  const items = getMenuItemsFromBlueprint(date, 'snack').items;
  return items.join(' + ');
}

function getBaseDayMenu(date: Date, diet: DietPreference): MenuDay {
  const dayIndex = date.getDay();
  const dateKey = getDateKey(date);
  const dayShort = WEEKDAY_SHORTS[dayIndex];
  const dayName = WEEKDAY_NAMES[dayIndex];
  const isToday = sameCalendarDay(date, getIstNow());

  const breakfast = getMenuItemsFromBlueprint(date, 'breakfast', diet);
  const lunch = dayIndex === 0 ? buildSundayLunchItems(date) : getMenuItemsFromBlueprint(date, 'lunch', diet);
  const snack = getMenuItemsFromBlueprint(date, 'snack', diet);
  const dinner = getMenuItemsFromBlueprint(date, 'dinner', diet);

  const lunchSpecial = dayIndex === 0
    ? lunch.special
    : undefined;

  return {
    dateKey,
    dayShort,
    dayName,
    dayOfMonth: String(date.getUTCDate()),
    isToday,
    meals: {
      breakfast: {
        id: 'meal-breakfast',
        label: 'Breakfast',
        mealType: 'breakfast',
        emoji: '🌅',
        time: MEAL_TIMINGS.breakfast.time,
        items: breakfast.items,
        deadline: MEAL_TIMINGS.breakfast.deadline,
        attendees: BASE_COUNTS.breakfast,
        capacity: FALLBACK_CAPACITY.breakfast,
      },
      lunch: {
        id: 'meal-lunch',
        label: 'Lunch',
        mealType: 'lunch',
        emoji: '☀️',
        time: MEAL_TIMINGS.lunch.time,
        items: lunch.items,
        special: lunchSpecial,
        deadline: MEAL_TIMINGS.lunch.deadline,
        attendees: BASE_COUNTS.lunch,
        capacity: FALLBACK_CAPACITY.lunch,
      },
      snack: {
        id: 'meal-snack',
        label: 'Snack',
        mealType: 'snack',
        emoji: '🍪',
        time: MEAL_TIMINGS.snack.time,
        items: snack.items,
        deadline: MEAL_TIMINGS.snack.deadline,
        attendees: BASE_COUNTS.snack,
        capacity: FALLBACK_CAPACITY.snack,
      },
      dinner: {
        id: 'meal-dinner',
        label: 'Dinner',
        mealType: 'dinner',
        emoji: '🌙',
        time: MEAL_TIMINGS.dinner.time,
        items: dinner.items,
        deadline: MEAL_TIMINGS.dinner.deadline,
        attendees: BASE_COUNTS.dinner,
        capacity: FALLBACK_CAPACITY.dinner,
      },
    },
  };
}

export function getTodayMenu(referenceDate = getIstNow(), diet: DietPreference = 'veg'): MenuDay {
  return getBaseDayMenu(referenceDate, diet);
}

export function getWeeklyMenu(referenceDate = getIstNow(), diet: DietPreference = 'veg'): MenuDay[] {
  const weekStart = getWeekStart(referenceDate);

  return Array.from({ length: 7 }, (_, index) => {
    const dayDate = new Date(weekStart);
    dayDate.setUTCDate(weekStart.getUTCDate() + index);
    return getBaseDayMenu(dayDate, diet);
  });
}

export function getWeekLabel(referenceDate = getIstNow()): string {
  const weekStart = getWeekStart(referenceDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

  const startLabel = weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const endLabel = weekEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  return `${startLabel} – ${endLabel}`;
}
