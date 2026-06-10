import { getMysqlPool } from '@/lib/db/mysql';
import { ensureMysqlSchema } from '@/lib/db/init';
import { isValidSqlDate } from '@/lib/validators/date';
import type { VoteMealType } from '@/lib/menu/votingBlueprints';
import crypto from 'crypto';

export type MealType = VoteMealType;

export type VotePayload = {
  student_id?: string;
  studentId?: string;
  vote_date?: string;
  voteDate?: string;
  meal_date?: string;
  mealDate?: string;
  meal_type?: MealType;
  mealType?: MealType;
  category_key?: string;
  categoryKey?: string;
  menu_option?: string;
  menuOption?: string;
  dish_option_id?: string;
  dishOptionId?: string;
  dish_name?: string;
  dishName?: string;
};

export type VoteAggregateRow = {
  mealType: MealType;
  categoryKey: string;
  menuOption: string;
  option: string;
  votes: number;
};

export type StudentVoteRow = {
  mealType: MealType;
  categoryKey: string;
  menuOption: string;
  option: string;
  votedAt: string | null;
  votes?: number;
};

export async function getVotes(date: string, studentId?: string) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  
  if (studentId) {
    const [rows] = await pool.execute(
      `SELECT meal_type AS mealType,
              category_key AS categoryKey,
              menu_option AS menuOption,
              dish_name AS \`option\`,
              voted_at AS votedAt
       FROM meal_votes
       WHERE meal_date = ? AND student_id = ?
       ORDER BY FIELD(meal_type, 'breakfast', 'lunch', 'snack', 'dinner')`,
      [date, studentId]
    );
    return rows as StudentVoteRow[];
  }

  // Get unique student counts per meal type for participation calculation
  const [participationRows] = await pool.execute(
    `SELECT meal_type AS mealType, COUNT(DISTINCT student_id) AS uniqueVoters
     FROM meal_votes
     WHERE meal_date = ?
     GROUP BY meal_type`,
    [date]
  );

  const [totalUniqueVotersRow] = await pool.execute(
    `SELECT COUNT(DISTINCT student_id) AS totalUniqueVoters
     FROM meal_votes
     WHERE meal_date = ?`,
    [date]
  );

  const [rows] = await pool.execute(
     `SELECT meal_type AS mealType,
             category_key AS categoryKey,
             menu_option AS menuOption,
             MAX(dish_name) AS \`option\`,
             COUNT(*) AS votes
      FROM meal_votes
      WHERE meal_date = ?
      GROUP BY meal_type, category_key, menu_option
      ORDER BY FIELD(meal_type, 'breakfast', 'lunch', 'snack', 'dinner'), votes DESC, menu_option ASC`,
     [date]
   );

  const [attendanceRows] = await pool.execute(
    `SELECT m.name AS meal_type,
            COALESCE(SUM(CASE WHEN mo.optin_status IN ('attending', 'takeaway') THEN 1 ELSE 0 END), 0) AS confirmed,
            COALESCE(SUM(CASE WHEN mo.optin_status IN ('attending', 'takeaway') AND u.food_preference = 'veg' THEN 1 ELSE 0 END), 0) AS veg_confirmed,
            COALESCE(SUM(CASE WHEN mo.optin_status IN ('attending', 'takeaway') AND u.food_preference = 'non_veg' THEN 1 ELSE 0 END), 0) AS non_veg_confirmed
     FROM meals m
     LEFT JOIN meal_optins mo ON mo.meal_id = m.id
     LEFT JOIN users u ON mo.student_id = u.id
     WHERE m.meal_date = ?
     GROUP BY m.id, m.name
    ORDER BY FIELD(m.name, 'breakfast', 'lunch', 'snack', 'dinner')`,
    [date]
  );

  const [totalStudentsRow] = await pool.execute(
    "SELECT COUNT(*) as count FROM users WHERE role = 'student'"
  );

  return {
    rows: rows as VoteAggregateRow[],
    totalStudents: (totalStudentsRow as any)[0]?.count || 0,
    totalUniqueVoters: (totalUniqueVotersRow as any)[0]?.totalUniqueVoters || 0,
    participation: (participationRows as any[]).reduce((acc, row) => {
      acc[row.mealType] = row.uniqueVoters;
      return acc;
    }, {} as Record<string, number>),
    attendanceCounts: (attendanceRows as any[]).map(r => ({
      mealType: r.meal_type,
      confirmed: Number(r.confirmed),
      vegConfirmed: Number(r.veg_confirmed),
      nonVegConfirmed: Number(r.non_veg_confirmed)
    }))
  };
}

export async function saveVotes(
  studentId: string,
  voteDate: string,
  votes: VotePayload[],
  clearCategories?: Array<{ mealType: MealType; categoryKey: string }>
) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const finalClearCategories = clearCategories && clearCategories.length > 0
    ? clearCategories
    : Array.from(new Set(votes.map(v => {
        const m = String(v.meal_type ?? v.mealType ?? '');
        const c = String(v.category_key ?? v.categoryKey ?? 'main');
        return `${m}:${c}`;
      })))
      .filter(str => str.split(':')[0] !== '')
      .map(str => {
        const [m, c] = str.split(':');
        return { mealType: m as MealType, categoryKey: c };
      });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Clear existing votes for the target categories
    for (const cat of finalClearCategories) {
      await connection.execute(
        `DELETE FROM meal_votes 
         WHERE student_id = ? AND vote_date = ? AND meal_type = ? AND category_key = ?`,
        [studentId, voteDate, cat.mealType, cat.categoryKey]
      );
    }

    // 2. Insert new votes
    for (const vote of votes) {
      const mealType = String(vote.meal_type ?? vote.mealType ?? '') as MealType;
      const categoryKey = String(vote.category_key ?? vote.categoryKey ?? 'main');
      const menuOption = String(vote.menu_option ?? vote.menuOption ?? vote.dish_option_id ?? vote.dishOptionId ?? '');
      const dishOptionId = String(vote.dish_option_id ?? vote.dishOptionId ?? menuOption);
      const dishName = String(vote.dish_name ?? vote.dishName ?? menuOption);

      if (!menuOption || !dishName) {
        throw new Error('Invalid vote payload: missing required fields');
      }

      if (!['breakfast', 'lunch', 'snack', 'dinner'].includes(mealType)) {
        throw new Error('Invalid meal type');
      }

      const voteId = crypto.randomUUID();

      await connection.execute(
        `INSERT INTO meal_votes (id, student_id, vote_date, meal_date, meal_type, category_key, menu_option, dish_option_id, dish_name, voted_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE 
           meal_date = VALUES(meal_date), 
           dish_option_id = VALUES(dish_option_id), 
           dish_name = VALUES(dish_name), 
           voted_at = NOW(), 
           updated_at = NOW()`,
        [voteId, studentId, voteDate, voteDate, mealType, categoryKey, menuOption, dishOptionId, dishName]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function countStudentVotes(studentId: string): Promise<number> {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS count FROM meal_votes WHERE student_id = ?`,
    [studentId]
  );

  return Number((rows as any[])[0]?.count ?? 0);
}
