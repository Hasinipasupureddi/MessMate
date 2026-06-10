/**
 * Ingredient calculation helper for mess meal planning
 */

export type IngredientCategory = 'grain' | 'vegetable' | 'dairy' | 'spice' | 'other';

export type Ingredient = {
  id: string;
  name: string;
  emoji: string;
  perPerson: number;
  unit: string;
  category: IngredientCategory;
  currentStock: number;
  stockUnit: string;
};

export type CalculatedIngredient = Ingredient & {
  required: number;
  stockOk: boolean;
  shortage: number;
};

/**
 * Base ingredient requirements (per person)
 * These represent standard quantities for a typical South Indian hostel mess meal
 */
// NOTE: Removed hardcoded BASE_INGREDIENTS. Calculations must use the
// `ingredient_catalog` table and `calculateIngredientsFromCatalog()` helper.
// This keeps all ingredient data in the DB and avoids stale, in-code defaults.

export function calculateIngredientsFromCatalog(
  catalog: Array<{ id: string; ingredient_name: string; unit: string; per_person_qty: number; current_stock?: number }> ,
  headcount: number,
  bufferPercent: number = 0
): CalculatedIngredient[] {
  const effectiveCount = Math.ceil(headcount * (1 + bufferPercent / 100));
  function inferCategory(id: string, name?: string): Ingredient['category'] {
    const lid = (id || '').toLowerCase();
    if (lid.includes('rice') || lid.includes('dal') || lid.includes('idly') || lid.includes('batter')) return 'grain';
    if (lid.includes('tomato') || lid.includes('onion') || lid.includes('potato')) return 'vegetable';
    if (lid.includes('curd') || /milk|yoghurt|dairy/.test((name||'').toLowerCase())) return 'dairy';
    if (lid.includes('tamarind') || /spice|pepper|chili/.test((name||'').toLowerCase())) return 'spice';
    return 'other';
  }

  return catalog.map(c => {
    const perPerson = Number(c.per_person_qty ?? 0) as number;
    const currentStock = Number((c as any).current_stock ?? 0);
    const category = inferCategory(c.id, c.ingredient_name);
    const ing: Ingredient = {
      id: c.id,
      name: c.ingredient_name,
      emoji: '🌾',
      perPerson,
      unit: c.unit,
      category,
      currentStock,
      stockUnit: c.unit,
    };

    const required = +(ing.perPerson * effectiveCount).toFixed(2);
    const stockOk = ing.currentStock >= required;
    const shortage = stockOk ? 0 : +(required - ing.currentStock).toFixed(2);

    return {
      ...ing,
      required,
      stockOk,
      shortage,
    };
  });
}

/**
 * Get shortage summary
 */
export function getShortageSummary(ingredients: CalculatedIngredient[]): {
  shortageCount: number;
  totalShortage: number;
  shortageItems: CalculatedIngredient[];
} {
  const shortageItems = ingredients.filter(ing => ing.shortage > 0);
  const totalShortage = Math.round(shortageItems.reduce((sum, ing) => sum + ing.shortage, 0) * 100) / 100;

  return {
    shortageCount: shortageItems.length,
    totalShortage,
    shortageItems,
  };
}

/**
 * Get ingredient summary by category
 */
export function getSummaryByCategory(ingredients: CalculatedIngredient[]): Record<IngredientCategory, { count: number; totalRequired: number }> {
  const summary: Record<IngredientCategory, { count: number; totalRequired: number }> = {
    grain: { count: 0, totalRequired: 0 },
    vegetable: { count: 0, totalRequired: 0 },
    dairy: { count: 0, totalRequired: 0 },
    spice: { count: 0, totalRequired: 0 },
    other: { count: 0, totalRequired: 0 },
  };

  ingredients.forEach(ing => {
    summary[ing.category].count++;
    summary[ing.category].totalRequired += ing.required;
  });

  return summary;
}
