import { getMysqlPool } from '@/lib/db/mysql';
import { ensureMysqlSchema } from '@/lib/db/init';

export async function getWardenKpis(date: string) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();
  
  // Count meal opt-ins for the date
  const [optinRows] = await pool.execute(
    `SELECT COUNT(*) as count FROM meal_optins
     WHERE meal_date = ? AND optin_status IN ('attending', 'takeaway')`,
    [date]
  );

  const totalOptins = (optinRows as any[])[0]?.count || 0;

  // Count unique students who opted into at least one meal
  const [uniqueParticipantRows] = await pool.execute(
    `SELECT COUNT(DISTINCT student_id) as count FROM meal_optins
     WHERE meal_date = ? AND optin_status IN ('attending', 'takeaway')`,
    [date]
  );

  const totalUniqueParticipants = (uniqueParticipantRows as any[])[0]?.count || 0;

  // Count waste logs for the date
  const [wasteRows] = await pool.execute(
    'SELECT COALESCE(SUM(amount), 0) as total FROM waste_logs WHERE log_date = ? AND unit = ?',
    [date, 'kg']
  );

  const totalWasteKg = (wasteRows as any[])[0]?.total || 0;

  // Get average rating for the date
  const [ratingRows] = await pool.execute(
    'SELECT COALESCE(AVG(rating), 0) as avg_rating FROM meal_ratings WHERE rating_date = ?',
    [date]
  );

  const avgRating = (ratingRows as any[])[0]?.avg_rating || 0;

  // Get total users count
  const [userRows] = await pool.execute(
    'SELECT COUNT(*) as count FROM users WHERE role = ?',
    ['student']
  );

  const totalStudents = (userRows as any[])[0]?.count || 0;

  // Get tomorrow's date for voting participation
  const tomorrow = new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Count unique voters for tomorrow
  const [voterRows] = await pool.execute(
    `SELECT COUNT(DISTINCT student_id) as count FROM meal_votes
     WHERE vote_date = ?`,
    [tomorrow]
  );
  const totalTomorrowVoters = (voterRows as any[])[0]?.count || 0;

  // Get Diet Distribution for unique participants today
  const [dietRows] = await pool.execute(
    `SELECT u.food_preference, COUNT(DISTINCT mo.student_id) as count
     FROM meal_optins mo
     JOIN users u ON mo.student_id = u.id
     WHERE mo.meal_date = ? AND mo.optin_status IN ('attending', 'takeaway')
     GROUP BY u.food_preference`,
    [date]
  );

  const dietCounts: Record<string, number> = { veg: 0, non_veg: 0 };
  (dietRows as any[]).forEach(row => {
    dietCounts[row.food_preference] = row.count;
  });

  return {
    totalWasteKg: Number(totalWasteKg),
    avgRating: Number(avgRating),
    totalOptins: Number(totalOptins),
    totalUniqueParticipants: Number(totalUniqueParticipants),
    totalStudents: Number(totalStudents),
    totalTomorrowVoters: Number(totalTomorrowVoters),
    dietCounts,
  };
}
