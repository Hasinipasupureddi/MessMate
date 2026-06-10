import {
  getMealCountsByDate,
  getMealsCatalogForDate,
  getMealStats as getMealStatsRange,
} from '@/lib/api/mealOptinsMySQL';

export async function getMealsByDate(date: string) {
  return getMealsCatalogForDate(date);
}

export { getMealCountsByDate, getMealStatsRange as getMealStats };
