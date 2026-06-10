type DemoLeftoverItem = {
  id: string;
  meal_date: string;
  meal_type: 'breakfast' | 'lunch' | 'snack' | 'dinner';
  dish_name: string;
  emoji: string;
  total_portions: number;
  claimed_count: number;
  available_until: string;
  is_active: boolean;
  claimed_by: string[];
};

const store = new Map<string, DemoLeftoverItem[]>();

function buildItems(date: string): DemoLeftoverItem[] {
  return [
    {
      id: `leftover-${date}-breakfast`,
      meal_date: date,
      meal_type: 'breakfast',
      dish_name: 'Idly Combo',
      emoji: '🥣',
      total_portions: 12,
      claimed_count: 4,
      available_until: `${date}T11:00:00.000Z`,
      is_active: true,
      claimed_by: [],
    },
    {
      id: `leftover-${date}-lunch`,
      meal_date: date,
      meal_type: 'lunch',
      dish_name: 'Rice + Dal + Curry',
      emoji: '🍛',
      total_portions: 18,
      claimed_count: 7,
      available_until: `${date}T15:00:00.000Z`,
      is_active: true,
      claimed_by: [],
    },
    {
      id: `leftover-${date}-snack`,
      meal_date: date,
      meal_type: 'snack',
      dish_name: 'Mirchi Bajji',
      emoji: '🌶️',
      total_portions: 20,
      claimed_count: 0,
      available_until: `${date}T17:30:00.000Z`,
      is_active: true,
      claimed_by: [],
    },
    {
      id: `leftover-${date}-dinner`,
      meal_date: date,
      meal_type: 'dinner',
      dish_name: 'Rice + Sambar',
      emoji: '🥘',
      total_portions: 10,
      claimed_count: 2,
      available_until: `${date}T22:00:00.000Z`,
      is_active: true,
      claimed_by: [],
    },
  ];
}

function getItems(date: string) {
  if (!store.has(date)) {
    store.set(date, buildItems(date));
  }

  return store.get(date)!;
}

function getDateFromLeftoverId(leftoverId: string) {
  const match = leftoverId.match(/^leftover-(\d{4}-\d{2}-\d{2})-/);
  return match?.[1] ?? null;
}

export function listDemoLeftovers(date: string) {
  return getItems(date).filter((item) => item.is_active);
}

export function claimDemoLeftover(leftoverId: string, userId: string) {
  const parsedDate = getDateFromLeftoverId(leftoverId);
  if (parsedDate) {
    getItems(parsedDate);
  }

  for (const items of store.values()) {
    const item = items.find((entry) => entry.id === leftoverId);
    if (!item) {
      continue;
    }

    if (item.claimed_by.includes(userId)) {
      return { success: false, message: 'You already claimed this item.' };
    }

    if (new Date(item.available_until) <= new Date()) {
      return { success: false, message: 'Claim window is closed.' };
    }

    if (item.claimed_count >= item.total_portions) {
      return { success: false, message: 'No portions left.' };
    }

    item.claimed_count += 1;
    item.claimed_by.push(userId);

    return { success: true, message: 'Claim successful.' };
  }

  return { success: false, message: 'Item not found.' };
}