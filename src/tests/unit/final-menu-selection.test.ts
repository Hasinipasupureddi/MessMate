import { buildFinalMenuDay } from '@/lib/menu/finalMenu';
import { getVoteBlueprintsForDate } from '@/lib/menu/votingBlueprints';
import { hydrateFinalMenuDay } from '@/lib/api/finalMenuMySQL';

test('Sunday snack and dinner voting are single-choice with exactly three options', () => {
  const blueprints = getVoteBlueprintsForDate(new Date('2026-06-07T00:00:00.000Z'));
  const snackBlueprint = blueprints.find((bp) => bp.mealType === 'snack');
  const dinnerBlueprint = blueprints.find((bp) => bp.mealType === 'dinner');

  expect(snackBlueprint).toBeDefined();
  expect(dinnerBlueprint).toBeDefined();
  expect(snackBlueprint?.categories).toEqual([
    { id: 'snack', label: 'Sunday Snack', type: 'snack', maxSelections: 1 }
  ]);
  expect(dinnerBlueprint?.categories).toEqual([
    { id: 'dinner', label: 'Sunday Dinner', type: 'main', maxSelections: 1 }
  ]);
  expect(snackBlueprint?.options.length).toBe(3);
  expect(dinnerBlueprint?.options.length).toBe(3);
});

test('Sunday snack options are available to all diet preferences', () => {
  const snackBlueprint = getVoteBlueprintsForDate(new Date('2026-06-07T00:00:00.000Z'))
    .find((bp) => bp.mealType === 'snack');

  expect(snackBlueprint).toBeDefined();
  expect(snackBlueprint?.options.every((opt) => opt.dietPreference === 'both')).toBe(true);
});

test('Sunday lunch blueprint splits veg and non-veg into separate categories', () => {
  const lunchBlueprint = getVoteBlueprintsForDate(new Date('2026-06-07T00:00:00.000Z'))
    .find((bp) => bp.mealType === 'lunch');

  expect(lunchBlueprint).toBeDefined();
  expect(lunchBlueprint?.categories).toEqual([
    { id: 'veg_combo', label: 'Veg Lunch', type: 'main', maxSelections: 1 },
    { id: 'non_veg_combo', label: 'Non-Veg Lunch', type: 'main', maxSelections: 1 },
  ]);
  expect(lunchBlueprint?.options.filter((opt) => opt.dietPreference === 'veg').every((opt) => opt.categoryKey === 'veg_combo')).toBe(true);
  expect(lunchBlueprint?.options.filter((opt) => opt.dietPreference === 'non_veg').every((opt) => opt.categoryKey === 'non_veg_combo')).toBe(true);
});

test('Sunday breakfast rotates to exactly three options', () => {
  const breakfastBlueprint = getVoteBlueprintsForDate(new Date('2026-06-07T00:00:00.000Z'))
    .find((bp) => bp.mealType === 'breakfast');

  expect(breakfastBlueprint).toBeDefined();
  expect(breakfastBlueprint?.options.length).toBe(3);
  expect(breakfastBlueprint?.options.every((opt) => opt.category === 'main')).toBe(true);
});

test('weekday breakfast and snack blueprints show exactly three options', () => {
  const weekdays = getVoteBlueprintsForDate(new Date('2026-06-08T00:00:00.000Z'));
  const breakfastBlueprint = weekdays.find((bp) => bp.mealType === 'breakfast');
  const snackBlueprint = weekdays.find((bp) => bp.mealType === 'snack');
  const dinnerBlueprint = weekdays.find((bp) => bp.mealType === 'dinner');

  expect(breakfastBlueprint?.options.length).toBe(3);
  expect(snackBlueprint?.options.length).toBe(3);
  expect(dinnerBlueprint?.options.length).toBe(3);
});

test('buildFinalMenuDay picks highest voted option per meal', () => {
  const votes = [
    { mealType: 'breakfast', categoryKey: 'main', menuOption: 'B04', option: 'Poori + Kurma', votes: 4 },
    { mealType: 'breakfast', categoryKey: 'main', menuOption: 'B02', option: 'Pesarattu + Ginger Chutney', votes: 0 },
    { mealType: 'breakfast', categoryKey: 'main', menuOption: 'B08', option: 'Pulihora + Curd', votes: 0 },
    { mealType: 'lunch', categoryKey: 'veg_combo', menuOption: 'L10', option: 'Thotakura Pappu + Bendakaya Fry + Pepper Rasam + Dosakaya Pachadi', votes: 3 },
    { mealType: 'lunch', categoryKey: 'veg_combo', menuOption: 'L02', option: 'Palakura Pappu + Beans Fry + Tomato Rasam + Kandi Pachadi', votes: 1 },
    { mealType: 'lunch', categoryKey: 'veg_combo', menuOption: 'L17', option: 'Muddapappu + Vankaya Masala + Coriander Rasam + Vankaya Pachadi', votes: 0 },
    { mealType: 'snack', categoryKey: 'snack', menuOption: 'S30', option: 'Sweet Corn Cup', votes: 3 },
    { mealType: 'snack', categoryKey: 'snack', menuOption: 'S09', option: 'Veg Puff', votes: 1 },
    { mealType: 'snack', categoryKey: 'snack', menuOption: 'S24', option: 'Biscuit Pack', votes: 0 },
    { mealType: 'dinner', categoryKey: 'dinner_combo', menuOption: 'D10', option: 'Mixed Vegetable Kurma + Dosakaya Pulusu + Gongura Pachadi', votes: 4 },
  ];

  const menu = buildFinalMenuDay(new Date('2026-06-06T00:00:00.000Z'), votes as any, new Map(), 7, new Map());
  const winners = Object.fromEntries(menu.meals.map((meal) => [meal.mealType, meal.winningItems[0]?.label]));

  expect(winners.breakfast).toBe('Poori + Kurma');
  expect(winners.lunch).toBe('Thotakura Pappu + Bendakaya Fry + Pepper Rasam + Dosakaya Pachadi');
  expect(winners.snack).toBe('Sweet Corn Cup');
  expect(winners.dinner).toBe('Mixed Vegetable Kurma + Dosakaya Pulusu + Gongura Pachadi');
});

test('buildFinalMenuDay chooses the highest vote count even when rotation shows another option as older', () => {
  const votes = [
    { mealType: 'breakfast', categoryKey: 'main', menuOption: 'B04', option: 'Poori + Kurma', votes: 5 },
    { mealType: 'breakfast', categoryKey: 'main', menuOption: 'B02', option: 'Pesarattu + Ginger Chutney', votes: 1 },
  ];
  const rotationMap = new Map<string, string | null>([
    ['B04', '2026-05-30'],
    ['B02', '2026-05-20'],
  ]);

  const menu = buildFinalMenuDay(new Date('2026-06-06T00:00:00.000Z'), votes as any, new Map(), 7, rotationMap);
  expect(menu.meals.find((meal) => meal.mealType === 'breakfast')?.winningItems[0]?.label).toBe('Poori + Kurma');
});

test('buildFinalMenuDay falls back to category.type when vote category key differs from blueprint id', () => {
  const votes = [
    { mealType: 'lunch', categoryKey: 'lunch_combo', menuOption: 'L10', option: 'Thotakura Pappu + Bendakaya Fry + Pepper Rasam + Dosakaya Pachadi', votes: 3 },
    { mealType: 'lunch', categoryKey: 'lunch_combo', menuOption: 'L02', option: 'Palakura Pappu + Beans Fry + Tomato Rasam + Kandi Pachadi', votes: 1 },
    { mealType: 'lunch', categoryKey: 'lunch_combo', menuOption: 'L17', option: 'Muddapappu + Vankaya Masala + Coriander Rasam + Vankaya Pachadi', votes: 0 },
  ];

  const menu = buildFinalMenuDay(new Date('2026-06-06T00:00:00.000Z'), votes as any, new Map(), 7, new Map());
  expect(menu.meals.find((meal) => meal.mealType === 'lunch')?.winningItems[0]?.label)
    .toBe('Thotakura Pappu + Bendakaya Fry + Pepper Rasam + Dosakaya Pachadi');
});

test('hydrateFinalMenuDay preserves saved winners when winningItemsJson is already parsed', () => {
  const rows = [
    {
      menuDate: '2026-06-06',
      mealType: 'breakfast',
      categoryKey: 'breakfast',
      winningItemId: 'B04',
      winningItemName: 'Poori + Kurma',
      winningItemsJson: [
        {
          emoji: '🫓',
          items: ['Poori', 'Potato Kurma'],
          label: 'Poori + Kurma',
          votes: 4,
          selectedOptionId: 'B04',
        },
      ],
      status: 'approved',
      winnerSource: 'votes',
      overrideReason: null,
      generatedAt: '2026-06-05T11:51:05.000Z',
    },
  ];

  const menu = hydrateFinalMenuDay('2026-06-06', rows as any);
  expect(menu.meals.find((meal) => meal.mealType === 'breakfast')?.winningItems[0]?.selectedOptionId).toBe('B04');
  expect(menu.meals.find((meal) => meal.mealType === 'breakfast')?.winningItems[0]?.votes).toBe(4);
});

test('buildFinalMenuDay falls back to meal-level votes when category-specific votes are missing', () => {
  const votes = [
    { mealType: 'lunch', categoryKey: 'main', menuOption: 'L10', option: 'Thotakura Pappu + Bendakaya Fry + Pepper Rasam + Dosakaya Pachadi', votes: 3 },
    { mealType: 'lunch', categoryKey: 'main', menuOption: 'L02', option: 'Palakura Pappu + Beans Fry + Tomato Rasam + Kandi Pachadi', votes: 1 },
    { mealType: 'lunch', categoryKey: 'main', menuOption: 'L17', option: 'Muddapappu + Vankaya Masala + Coriander Rasam + Vankaya Pachadi', votes: 0 },
  ];

  const menu = buildFinalMenuDay(new Date('2026-06-06T00:00:00.000Z'), votes as any, new Map(), 7, new Map());
  expect(menu.meals.find((meal) => meal.mealType === 'lunch')?.winningItems[0]?.label)
    .toBe('Thotakura Pappu + Bendakaya Fry + Pepper Rasam + Dosakaya Pachadi');
});
