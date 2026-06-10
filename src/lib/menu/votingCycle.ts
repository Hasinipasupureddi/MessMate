import { BREAKFAST_CATALOG } from './breakfastCatalog';
import { LUNCH_CATALOG } from './lunchCatalog';
import { DINNER_CATALOG } from './dinnerCatalog';
import { SNACK_CATALOG } from './snackCatalog';

export const VOTING_CYCLE_LENGTH = 24;

export const BREAKFAST_CYCLE: string[][] = [
  ['B01', 'B05', 'B06'], // Day 1
  ['B02', 'B04', 'B12'], // Day 2
  ['B07', 'B16', 'B15'], // Day 3
  ['B13', 'B03', 'B17'], // Day 4
  ['B11', 'B14', 'B08'], // Day 5
  ['B21', 'B10', 'B18'], // Day 6
  ['B22', 'B24', 'B19'], // Day 7
  ['B23', 'B04', 'B20'], // Day 8
  ['B01', 'B16', 'B15'], // Day 9
  ['B02', 'B05', 'B06'], // Day 10
  ['B07', 'B14', 'B08'], // Day 11
  ['B11', 'B10', 'B17'], // Day 12
  ['B13', 'B04', 'B19'], // Day 13
  ['B22', 'B24', 'B18'], // Day 14
  ['B23', 'B16', 'B20'], // Day 15
  ['B21', 'B05', 'B06'], // Day 16
  ['B01', 'B14', 'B15'], // Day 17
  ['B02', 'B04', 'B08'], // Day 18
  ['B07', 'B10', 'B17'], // Day 19
  ['B11', 'B24', 'B19'], // Day 20
  ['B13', 'B16', 'B18'], // Day 21
  ['B22', 'B05', 'B20'], // Day 22
  ['B23', 'B04', 'B06'], // Day 23
  ['B21', 'B14', 'B08'], // Day 24
];

export const LUNCH_CYCLE: string[][] = Array.from({ length: 24 }, (_, i) => {
  const day = i + 1;
  const optA = `L${String(day).padStart(2, '0')}`;
  const optB = `L${String(((day + 8 - 1) % 24) + 1).padStart(2, '0')}`;
  const optC = `L${String(((day + 16 - 1) % 24) + 1).padStart(2, '0')}`;
  return [optA, optB, optC];
});

export const DINNER_CYCLE: string[][] = Array.from({ length: 24 }, (_, i) => {
  const day = i + 1;
  const optA = `D${String(day).padStart(2, '0')}`;
  const optB = `D${String(((day + 8 - 1) % 24) + 1).padStart(2, '0')}`;
  const optC = `D${String(((day + 16 - 1) % 24) + 1).padStart(2, '0')}`;
  return [optA, optB, optC];
});

// For snacks, the user provided 7 days and said "Repeat with remaining items".
// Fried: S01-S12 (12 items)
// Healthy/Chaat: S13-S20, S30 (9 items)
// Bakery/Sweet: S21-S25 (Bakery, 5 items), S31-S35 (Sweet, 5 items) = 10 items
// Total Fried: 12, Healthy: 9, Bakery/Sweet: 10
// We need 24 days. We will cycle through these lists.

const friedSnacks = ['S01', 'S02', 'S04', 'S05', 'S10', 'S09', 'S08', 'S03', 'S06', 'S07', 'S11', 'S12']; // 12 items
const healthySnacks = ['S13', 'S14', 'S15', 'S20', 'S19', 'S17', 'S18', 'S16', 'S30']; // 9 items
const bakerySweetSnacks = ['S21', 'S22', 'S23', 'S25', 'S31', 'S32', 'S33', 'S24', 'S34', 'S35']; // 10 items

export const SNACK_CYCLE: string[][] = Array.from({ length: 24 }, (_, i) => {
  return [
    friedSnacks[i % friedSnacks.length],
    healthySnacks[i % healthySnacks.length],
    bakerySweetSnacks[i % bakerySweetSnacks.length],
  ];
});

export function getDayIndex(date: Date): number {
  // Use a fixed reference point for the cycle (e.g., June 1, 2024 - a Saturday)
  const referenceDate = new Date('2024-06-01');
  
  let weekdayCount = 0;
  let current = new Date(referenceDate);
  
  // Normalize dates to midnight UTC for counting
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  current.setHours(0, 0, 0, 0);

  if (target < current) return 0;

  while (current < target) {
    weekdayCount++;
    current.setDate(current.getDate() + 1);
  }

  return (weekdayCount + 11) % VOTING_CYCLE_LENGTH;
}
