import { getMysqlPool } from '@/lib/db/mysql';
import { ensureMysqlSchema } from '@/lib/db/init';

export type IngredientCatalogRow = {
  id: string;
  ingredient_name: string;
  unit: string;
  per_person_qty: number;
  current_stock?: number;
};

export async function listIngredientCatalog(): Promise<IngredientCatalogRow[]> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [rows] = await pool.execute(
    `SELECT ic.id,
            ic.ingredient_name,
            ic.unit,
            ic.per_person_qty,
            COALESCE(isr.current_stock, 0) AS current_stock
     FROM ingredient_catalog ic
     LEFT JOIN ingredient_stock isr ON isr.ingredient_id = ic.id
     ORDER BY FIELD(ic.id, 'ing-rice','ing-dal','ing-tomato','ing-onion','ing-potato','ing-oil','ing-curd','ing-tamarind','ing-idly-batter','ing-coconut','ing-wheat-flour') ASC`
  );

  const mapped = (rows as any[])?.map(r => ({
    id: r.id,
    ingredient_name: r.ingredient_name,
    unit: r.unit,
    per_person_qty: Number(r.per_person_qty || 0),
    current_stock: Number(r.current_stock || 0),
  })) || [];

  if (mapped.length === 0) {
    // Fallback to a sensible default catalog for dev/test environments
    return [
      { id: 'ing-rice', ingredient_name: 'Rice', unit: 'kg', per_person_qty: 0.3, current_stock: 85 },
      { id: 'ing-dal', ingredient_name: 'Toor Dal', unit: 'kg', per_person_qty: 0.12, current_stock: 32 },
      { id: 'ing-tomato', ingredient_name: 'Tomatoes', unit: 'kg', per_person_qty: 0.08, current_stock: 18 },
      { id: 'ing-onion', ingredient_name: 'Onions', unit: 'kg', per_person_qty: 0.06, current_stock: 22 },
      { id: 'ing-potato', ingredient_name: 'Potatoes', unit: 'kg', per_person_qty: 0.1, current_stock: 28 },
      { id: 'ing-oil', ingredient_name: 'Cooking Oil', unit: 'litres', per_person_qty: 0.015, current_stock: 12 },
      { id: 'ing-curd', ingredient_name: 'Curd', unit: 'litres', per_person_qty: 0.15, current_stock: 35 },
      { id: 'ing-tamarind', ingredient_name: 'Tamarind', unit: 'kg', per_person_qty: 0.005, current_stock: 3.5 },
      { id: 'ing-idly-batter', ingredient_name: 'Idly Batter', unit: 'kg', per_person_qty: 0.18, current_stock: 0 },
      { id: 'ing-coconut', ingredient_name: 'Coconut', unit: 'pcs', per_person_qty: 0.02, current_stock: 24 },
      { id: 'ing-wheat-flour', ingredient_name: 'Wheat Flour', unit: 'kg', per_person_qty: 0.12, current_stock: 15 },
    ];
  }

  return mapped;
}
