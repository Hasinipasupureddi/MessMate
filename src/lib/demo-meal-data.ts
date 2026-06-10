export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export type MealOptinStatus = 'attending' | 'skip' | 'takeaway';

type DemoMeal = {
  id: string;
  name: MealType;
  meal_date: string;
  created_at: string;
};

type DemoOptin = {
  studentId: string;
  mealDate: string;
  mealType: MealType;
  mealId: string;
  status: MealOptinStatus;
  updatedAt: string;
};

type DemoVote = {
  studentId: string;
  voteDate: string;
  mealType: 'breakfast' | 'lunch';
  dishOptionId: string;
  dishName: string;
};

type DemoRating = {
  studentId: string;
  ratingDate: string;
  mealType: MealType;
  dishName: string;
  rating: number;
  wasteAmount: string;
};

const MEAL_IDS: Record<MealType, string> = {
  breakfast: 'meal-breakfast',
  lunch: 'meal-lunch',
  snack: 'meal-snack',
  dinner: 'meal-dinner',
};

const BASE_MEAL_COUNTS: Record<MealType, number> = {
  breakfast: 187,
  lunch: 203,
  snack: 50,
  dinner: 0,
};

const optinsByDate = new Map<string, Map<string, DemoOptin>>();
const votesByDate = new Map<string, Map<string, DemoVote>>();
const ratingsByDate = new Map<string, Map<string, DemoRating>>();

function getMealStore<T>(store: Map<string, Map<string, T>>, date: string) {
  if (!store.has(date)) {
    store.set(date, new Map<string, T>());
  }

  return store.get(date)!;
}

export function getDemoMeals(date: string): DemoMeal[] {
  return [
    { id: MEAL_IDS.breakfast, name: 'breakfast', meal_date: date, created_at: `${date}T00:00:00.000Z` },
    { id: MEAL_IDS.lunch, name: 'lunch', meal_date: date, created_at: `${date}T00:00:00.000Z` },
    { id: MEAL_IDS.snack, name: 'snack', meal_date: date, created_at: `${date}T00:00:00.000Z` },
    { id: MEAL_IDS.dinner, name: 'dinner', meal_date: date, created_at: `${date}T00:00:00.000Z` },
  ];
}

export function saveDemoOptin(input: {
  studentId: string;
  mealDate: string;
  mealType: MealType;
  status: MealOptinStatus;
}) {
  const store = getMealStore(optinsByDate, input.mealDate);
  const key = `${input.studentId}:${input.mealType}`;
  const row: DemoOptin = {
    studentId: input.studentId,
    mealDate: input.mealDate,
    mealType: input.mealType,
    mealId: MEAL_IDS[input.mealType],
    status: input.status,
    updatedAt: new Date().toISOString(),
  };

  store.set(key, row);
  return row;
}

export function getDemoStudentOptins(studentId: string, mealDate: string) {
  const store = getMealStore(optinsByDate, mealDate);
  return [...store.values()]
    .filter((row) => row.studentId === studentId)
    .map((row) => ({
      id: `${row.studentId}:${row.mealType}`,
      student_id: row.studentId,
      meal_id: row.mealId,
      status: row.status,
      updated_at: row.updatedAt,
      meal: {
        name: row.mealType,
        meal_date: row.mealDate,
        created_at: `${row.mealDate}T00:00:00.000Z`,
      },
    }));
}

export function getDemoMealCounts(mealDate: string) {
  const store = getMealStore(optinsByDate, mealDate);
  const optins = [...store.values()];

  return getDemoMeals(mealDate).map((meal) => {
    const positiveCount = optins.filter(
      (row) => row.mealType === meal.name && (row.status === 'attending' || row.status === 'takeaway')
    ).length;
    const skipCount = optins.filter((row) => row.mealType === meal.name && row.status === 'skip').length;
    const confirmed = Math.max(0, BASE_MEAL_COUNTS[meal.name] + positiveCount - skipCount);

    return {
      meal_id: meal.id,
      meal_type: meal.name,
      meal_date: meal.meal_date,
      confirmed,
    };
  });
}

export function saveDemoVotes(votes: Array<{
  student_id: string;
  vote_date: string;
  meal_type: 'breakfast' | 'lunch';
  dish_option_id: string;
  dish_name: string;
}>) {
  const voteDate = votes[0]?.vote_date;
  const store = getMealStore(votesByDate, voteDate);

  votes.forEach((vote) => {
    const key = `${vote.student_id}:${vote.meal_type}`;
    store.set(key, {
      studentId: vote.student_id,
      voteDate: vote.vote_date,
      mealType: vote.meal_type,
      dishOptionId: vote.dish_option_id,
      dishName: vote.dish_name,
    });
  });
}

export function getDemoVotes(mealDate: string, studentId?: string) {
  const store = getMealStore(votesByDate, mealDate);
  const rows = [...store.values()];

  if (studentId) {
    return rows
      .filter((row) => row.studentId === studentId)
      .map((row) => ({
        meal_type: row.mealType,
        dish_option_id: row.dishOptionId,
      }));
  }

  const grouped = rows.reduce((acc: Record<string, { meal_type: string; dish_option_id: string; total_votes: number }>, row) => {
    const key = `${row.mealType}:${row.dishOptionId}`;
    if (!acc[key]) {
      acc[key] = {
        meal_type: row.mealType,
        dish_option_id: row.dishOptionId,
        total_votes: 0,
      };
    }

    acc[key].total_votes += 1;
    return acc;
  }, {});

  return Object.values(grouped);
}

export function saveDemoRating(input: {
  studentId: string;
  ratingDate: string;
  mealType: MealType;
  dishName: string;
  rating: number;
  wasteAmount: string;
}) {
  const store = getMealStore(ratingsByDate, input.ratingDate);
  const key = `${input.studentId}:${input.mealType}`;
  store.set(key, {
    studentId: input.studentId,
    ratingDate: input.ratingDate,
    mealType: input.mealType,
    dishName: input.dishName,
    rating: input.rating,
    wasteAmount: input.wasteAmount,
  });
}

export function getDemoRatings(studentId: string, ratingDate: string) {
  const store = getMealStore(ratingsByDate, ratingDate);
  return [...store.values()]
    .filter((row) => row.studentId === studentId)
    .map((row) => ({
      meal_type: row.mealType,
      rating: row.rating,
      waste_amount: row.wasteAmount,
    }));
}