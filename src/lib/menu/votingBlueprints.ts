import { BREAKFAST_CATALOG } from './breakfastCatalog';
import { LUNCH_CATALOG } from './lunchCatalog';
import { DINNER_CATALOG } from './dinnerCatalog';
import { SNACK_CATALOG } from './snackCatalog';
import { 
  SUNDAY_LUNCH_W1, SUNDAY_LUNCH_W2, SUNDAY_LUNCH_W3, SUNDAY_LUNCH_W4,
  SUNDAY_DINNER_W1, SUNDAY_DINNER_W2, SUNDAY_DINNER_W3, SUNDAY_DINNER_W4,
  SUNDAY_SNACK_W1, SUNDAY_SNACK_W2, SUNDAY_SNACK_W3, SUNDAY_SNACK_W4,
  WEDNESDAY_LUNCH_SPECIAL, FRIDAY_LUNCH_SPECIAL_ADDONS, FRIDAY_DINNER_SPECIAL,
  WEDNESDAY_SPECIAL_OPTIONS
} from './sundayCatalog';
import { getDayIndex, BREAKFAST_CYCLE, LUNCH_CYCLE, SNACK_CYCLE, DINNER_CYCLE } from './votingCycle';

export type VoteMealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export type VoteOption = {
  id: string;
  label: string;
  emoji: string;
  items: string[];
  category: 'main' | 'pappu' | 'veg_curry' | 'non_veg_curry' | 'snack' | 'side' | 'sambar' | 'lunch_combo' | 'dinner_combo' | 'pachadi';
  categoryKey?: string;
  isDefault?: boolean;
  dietPreference?: 'veg' | 'non_veg' | 'both';
  comboId?: string; // L01, B01, etc.
  family?: string;
  subFamilies?: string[]; // ['Tomato', 'Potato', 'Rasam', 'Gongura']
};

export type VoteBlueprint = {
  mealType: VoteMealType;
  key: string;
  title: string;
  subtitle: string;
  fixedItems: string[];
  categories: Array<{
    id: string;
    label: string;
    type: VoteOption['category'];
    description?: string;
    maxSelections?: number; // If > 1, enables multi-select voting (checkboxes, top-N win)
  }>;
  options: VoteOption[];
  isSpecialDay?: boolean;
  isFixedMenu?: boolean;
  participationThreshold?: number;
  cooldownWeeks?: number;
};

export const DEFAULT_FIXED_ITEMS = {
  breakfast: ['Tea', 'Milk'],
  lunch: ['Rice', 'Curd', 'Pickle'],
  snack: ['Tea', 'Milk'],
  dinner: ['Rice', 'Curd'],
} as const;

export function isSpecialFriday(date: Date): boolean {
  const weekNum = Math.ceil(date.getDate() / 7);
  return date.getDay() === 5 && (weekNum === 2 || weekNum === 3);
}

export function isSpecialSunday(date: Date): boolean {
  return date.getDay() === 0;
}

export function isSpecialWednesday(date: Date): boolean {
  return date.getDay() === 3 && Math.ceil(date.getDate() / 7) === 4;
}

export const VOTE_BLUEPRINTS: Record<number, VoteBlueprint[]> = {
  0: [
    {
      mealType: 'breakfast',
      key: 'breakfast',
      title: 'Breakfast',
      subtitle: 'Tea and milk stay fixed; students choose the main dish',
      fixedItems: [...DEFAULT_FIXED_ITEMS.breakfast],
      categories: [{ id: 'main', label: 'Main Dish', type: 'main' }],
      options: BREAKFAST_CATALOG,
      participationThreshold: 0.2,
    },
    {
      mealType: 'lunch',
      key: 'sunday-lunch',
      title: 'Sunday Feast',
      subtitle: 'Choose your special meal',
      fixedItems: [],
      categories: [{ id: 'main', label: 'Special Meal', type: 'main' }],
      options: SUNDAY_LUNCH_W1,
      isSpecialDay: true,
      participationThreshold: 0.2,
    },
    {
      mealType: 'snack',
      key: 'sunday-snack',
      title: 'Sunday Evening Snack',
      subtitle: 'Tea and milk are fixed — vote for your favourite Sunday snack!',
      fixedItems: [...DEFAULT_FIXED_ITEMS.snack],
      categories: [{ id: 'snack', label: 'Sunday Snack', type: 'snack', maxSelections: 1 }],
      options: SUNDAY_SNACK_W1,
      isSpecialDay: true,
      participationThreshold: 0.2,
    },
    {
      mealType: 'dinner',
      key: 'sunday-dinner',
      title: 'Sunday Dinner',
      subtitle: 'Special rice & pulao meals — vote for your favourite!',
      fixedItems: [...DEFAULT_FIXED_ITEMS.dinner],
      categories: [{ id: 'dinner', label: 'Sunday Dinner', type: 'main', maxSelections: 1 }],
      options: SUNDAY_DINNER_W1,
      isSpecialDay: true,
      participationThreshold: 0.2,
    },
  ],
  1: [
    {
      mealType: 'breakfast',
      key: 'breakfast',
      title: 'Breakfast',
      subtitle: 'Tea and milk stay fixed; students choose the main dish',
      fixedItems: [...DEFAULT_FIXED_ITEMS.breakfast],
      categories: [{ id: 'main', label: 'Main Dish', type: 'main' }],
      options: BREAKFAST_CATALOG,
      participationThreshold: 0.2,
    },
    {
      mealType: 'lunch',
      key: 'lunch',
      title: 'Lunch',
      subtitle: 'Select from our L24 Master Rotation. Variety guaranteed!',
      fixedItems: [...DEFAULT_FIXED_ITEMS.lunch],
      categories: [
        { id: 'veg_combo', label: 'Veg Combo', type: 'lunch_combo' },
      ],
      options: LUNCH_CATALOG,
      participationThreshold: 0.2,
    },
    {
      mealType: 'snack',
      key: 'snack',
      title: 'Evening Snack',
      subtitle: 'Tea and milk stay fixed; students choose the snack',
      fixedItems: [...DEFAULT_FIXED_ITEMS.snack],
      categories: [{ id: 'snack', label: 'Snack Item', type: 'snack' }],
      options: SNACK_CATALOG,
      participationThreshold: 0.2,
    },
    {
      mealType: 'dinner',
      key: 'dinner',
      title: 'Dinner',
      subtitle: 'Select from our D24 Master Rotation. Variety guaranteed!',
      fixedItems: [...DEFAULT_FIXED_ITEMS.dinner],
      categories: [
        { id: 'dinner_combo', label: 'Dinner Combo', type: 'dinner_combo' },
      ],
      options: DINNER_CATALOG,
      participationThreshold: 0.2,
    },
  ],
};

// Copy Monday to other weekdays
[2, 3, 4, 5, 6].forEach(day => {
  VOTE_BLUEPRINTS[day] = VOTE_BLUEPRINTS[1];
});

export function getVoteBlueprintsForDate(date: Date): VoteBlueprint[] {
  // Deep copy blueprints to avoid sharing categories array between different calls
  const blueprints = (VOTE_BLUEPRINTS[date.getDay()] ?? VOTE_BLUEPRINTS[1]).map(b => ({ 
    ...b, 
    categories: [...b.categories],
    options: [...b.options]
  }));
  const weekNum = Math.ceil(date.getDate() / 7);
  const dayIndex = getDayIndex(date);
  const isSunday = date.getDay() === 0;
  const isThursday = date.getDay() === 4;

  // 1. Apply Normal Weekday Rotation for breakfast every day, and for lunch/snack/dinner on Mon-Sat.
  blueprints.forEach(blueprint => {
    let cycleIds: string[] = [];
    let catalog: VoteOption[] = [];
    let shouldRotate = false;

    switch (blueprint.mealType) {
      case 'breakfast':
        cycleIds = BREAKFAST_CYCLE[dayIndex];
        catalog = BREAKFAST_CATALOG;
        shouldRotate = true;
        break;
      case 'lunch':
        shouldRotate = !isSunday;
        cycleIds = LUNCH_CYCLE[dayIndex];
        catalog = LUNCH_CATALOG;
        break;
      case 'snack':
        shouldRotate = !isSunday;
        cycleIds = SNACK_CYCLE[dayIndex];
        catalog = SNACK_CATALOG;
        break;
      case 'dinner':
        shouldRotate = !isSunday;
        cycleIds = DINNER_CYCLE[dayIndex];
        catalog = DINNER_CATALOG;
        break;
    }

    if (shouldRotate && cycleIds.length > 0) {
      const cycleOptions = catalog.filter(o => cycleIds.includes(o.id));
      const otherOptions = catalog.filter(o => !cycleIds.includes(o.id));
      
      let combined = [...cycleOptions, ...otherOptions];
      
      // Strict Veg-only day enforcement (e.g., Thursday)
      if (isThursday) {
        combined = combined.filter(o => !o.dietPreference || o.dietPreference === 'both' || o.dietPreference === 'veg');
      }
      
      blueprint.options = combined;
    }
  });

  // 2. Apply Sunday Special Menu (Overrides everything on Sundays)
  if (isSunday) {
    blueprints.forEach(blueprint => {
      if (blueprint.mealType === 'lunch') {
        const lunchOptions = [SUNDAY_LUNCH_W1, SUNDAY_LUNCH_W2, SUNDAY_LUNCH_W3, SUNDAY_LUNCH_W4][(weekNum - 1) % 4]
          .map((opt) => ({
            ...opt,
            categoryKey: opt.dietPreference === 'veg' ? 'veg_combo' : opt.dietPreference === 'non_veg' ? 'non_veg_combo' : 'main',
          }));
        blueprint.title = `Sunday Feast`;
        blueprint.subtitle = 'Choose your special meal based on your diet preference';
        blueprint.options = lunchOptions;
        blueprint.categories = [
          { id: 'veg_combo', label: 'Veg Lunch', type: 'main', maxSelections: 1 },
          { id: 'non_veg_combo', label: 'Non-Veg Lunch', type: 'main', maxSelections: 1 },
        ];
        blueprint.isSpecialDay = true;
      }
      if (blueprint.mealType === 'snack') {
        const snackOptions = [SUNDAY_SNACK_W1, SUNDAY_SNACK_W2, SUNDAY_SNACK_W3, SUNDAY_SNACK_W4][(weekNum - 1) % 4];
        blueprint.title = 'Sunday Evening Snack';
        blueprint.subtitle = 'Tea and milk are fixed — vote for your favourite Sunday snack!';
        blueprint.options = snackOptions;
        blueprint.categories = [{ id: 'snack', label: 'Sunday Snack', type: 'snack', maxSelections: 1 }];
        blueprint.isSpecialDay = true;
      }
      if (blueprint.mealType === 'dinner') {
        const dinnerOptions = [SUNDAY_DINNER_W1, SUNDAY_DINNER_W2, SUNDAY_DINNER_W3, SUNDAY_DINNER_W4][(weekNum - 1) % 4];
        blueprint.title = 'Sunday Dinner';
        blueprint.subtitle = 'Special rice & pulao meals — common menu for everyone!';
        blueprint.options = dinnerOptions.map(opt => ({ ...opt, dietPreference: 'both' }));
        blueprint.categories = [{ id: 'dinner', label: 'Sunday Dinner', type: 'main', maxSelections: 1 }];
        blueprint.fixedItems = []; // No Rice/Curd fallback for Sunday pulao dinner
        blueprint.isSpecialDay = true;
      }
    });
  }

  // 3. Apply Monthly Special Events (Overrides weekday/Sunday if applicable, but usually on weekdays)
  
  // Every Wednesday Special Item (Added to normal lunch)
  if (date.getDay() === 3) {
    const lunchIdx = blueprints.findIndex(b => b.mealType === 'lunch');
    if (lunchIdx !== -1) {
      // If it's Week 4 Wednesday, override the entire lunch with Bagara Rice special
      if (weekNum === 4 || (date.getMonth() === 5 && date.getDate() === 24)) {
        blueprints[lunchIdx] = {
          ...blueprints[lunchIdx],
          title: 'Week 4 Wednesday Special Feast',
          subtitle: 'Bagara Rice + Raita + Special Extras',
          isSpecialDay: true,
          fixedItems: ['Bagara Rice', 'Raita', 'Curd'],
          categories: [
            { id: 'side', label: 'Special Item', type: 'side' },
            { id: 'non_veg_side', label: 'Non-Veg Add-on', type: 'side' }
          ],
          options: WEDNESDAY_SPECIAL_OPTIONS.map(o => ({ 
            ...o, 
            category: 'side' as any,
            categoryKey: o.dietPreference === 'non_veg' ? 'non_veg_side' : 'side'
          }))
        };
      } else {
        // Normal Wednesday: Just add a special side item vote
        blueprints[lunchIdx].title = 'Wednesday Special Lunch';
        blueprints[lunchIdx].subtitle = 'L24 Combo + Special Item';
        
        // Add categories
        blueprints[lunchIdx].categories.push({ id: 'side', label: 'Special Item', type: 'side' });
        blueprints[lunchIdx].categories.push({ id: 'non_veg_side', label: 'Non-Veg Add-on', type: 'side' });

        // Map options to categories
        const mappedWednesday = WEDNESDAY_SPECIAL_OPTIONS.map(o => ({ 
          ...o, 
          category: 'side' as any,
          categoryKey: o.dietPreference === 'non_veg' ? 'non_veg_side' : 'side'
        }));
        
        blueprints[lunchIdx].options = [...blueprints[lunchIdx].options, ...mappedWednesday];
      }
    }
  }

  // Week 2 Friday Lunch Special (Add-ons)
  // User noted June 5 (Friday) as Week 2. Adjusted logic to match user expectation for June 2026.
  const isFriW2 = date.getDay() === 5 && 
    (weekNum === 2 || (date.getMonth() === 5 && (date.getDate() === 5 || date.getDate() === 12)));
  if (isFriW2) {
    const lunchIdx = blueprints.findIndex(b => b.mealType === 'lunch');
    if (lunchIdx !== -1) {
      blueprints[lunchIdx].title = 'Week 2 Friday Special Lunch';
      blueprints[lunchIdx].subtitle = 'L24 Combo + Special Add-ons';
      
      // Add categories
      blueprints[lunchIdx].categories.push({ id: 'side', label: 'Special Add-on', type: 'side' });
      blueprints[lunchIdx].categories.push({ id: 'non_veg_side', label: 'Non-Veg Add-on', type: 'side' });

      // Map options to categories
      const mappedAddons = FRIDAY_LUNCH_SPECIAL_ADDONS.map(o => ({ 
        ...o, 
        category: 'side' as any,
        categoryKey: o.dietPreference === 'non_veg' ? 'non_veg_side' : 'side'
      }));
      
      blueprints[lunchIdx].options = [...blueprints[lunchIdx].options, ...mappedAddons];
    }
  }

  // Week 3 Friday Dinner Special (Replace normal dinner)
  const isFriW3 = date.getDay() === 5 && weekNum === 3;
  if (isFriW3) {
    const dinnerIdx = blueprints.findIndex(b => b.mealType === 'dinner');
    if (dinnerIdx !== -1) {
      blueprints[dinnerIdx] = {
        ...blueprints[dinnerIdx],
        title: 'Week 3 Friday Special Dinner',
        subtitle: 'Special Fried Rice Selection',
        isSpecialDay: true,
        categories: [
          { id: 'veg_main', label: 'Veg Dinner Choice', type: 'main' },
          { id: 'non_veg_main', label: 'Non-Veg Dinner Choice', type: 'main' }
        ],
        options: FRIDAY_DINNER_SPECIAL.map(o => ({
          ...o,
          categoryKey: o.dietPreference === 'non_veg' ? 'non_veg_main' : 'veg_main'
        }))
      };
    }
  }

  return blueprints;
}

export function getVoteBlueprintForMeal(date: Date, mealType: VoteMealType): VoteBlueprint | null {
  return getVoteBlueprintsForDate(date).find((blueprint) => blueprint.mealType === mealType) ?? null;
}

export function getDefaultBlueprintForMeal(mealType: VoteMealType): VoteBlueprint {
  switch (mealType) {
    case 'breakfast':
      return {
        mealType,
        key: 'default-breakfast',
        title: 'Breakfast',
        subtitle: 'Tea and milk stay fixed; students vote for the rotating main dish',
        fixedItems: [...DEFAULT_FIXED_ITEMS.breakfast],
        categories: [{ id: 'main', label: 'Main Dish', type: 'main' }],
        options: BREAKFAST_CATALOG,
      };
    case 'lunch':
      return {
        mealType,
        key: 'default-lunch',
        title: 'Lunch',
        subtitle: 'Fixed staples plus a rotating combo',
        fixedItems: [...DEFAULT_FIXED_ITEMS.lunch],
        categories: [
          { id: 'veg_combo', label: 'Veg Combo', type: 'lunch_combo' },
        ],
        options: LUNCH_CATALOG,
      };
    case 'snack':
      return {
        mealType,
        key: 'default-snack',
        title: 'Evening Snack',
        subtitle: 'Tea and milk stay fixed; students vote for the snack',
        fixedItems: [...DEFAULT_FIXED_ITEMS.snack],
        categories: [{ id: 'snack', label: 'Snack Item', type: 'snack' }],
        options: SNACK_CATALOG,
      };
    case 'dinner':
      return {
        mealType,
        key: 'default-dinner',
        title: 'Dinner',
        subtitle: 'Fixed staples plus a rotating dinner combo',
        fixedItems: [...DEFAULT_FIXED_ITEMS.dinner],
        categories: [
          { id: 'dinner_combo', label: 'Dinner Combo', type: 'dinner_combo' },
        ],
        options: DINNER_CATALOG,
      };
  }
}
