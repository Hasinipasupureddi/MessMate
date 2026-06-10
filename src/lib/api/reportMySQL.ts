
import { getMysqlPool } from '@/lib/db/mysql';
import { ensureMysqlSchema } from '@/lib/db/init';

function simplifyMenuName(name: string): string {
  if (!name) return '';
  return name.split('+')[0].trim().split('-')[0].trim();
}

type AttendanceTrend = {
  date: string;
  meal_type: string;
  count: number;
};

type RatedMeal = {
  dish_name: string;
  avgRating: number;
};

type RequestedMeal = {
  dish_name: string;
  votes: number;
};

type WasteBreakdown = {
  meal_type: string;
  totalAmount: number;
};

type ReportLeftoverStats = {
  totalDeclarations: number;
  totalPortionsDeclared: number;
  totalClaimed: number;
  recoveryRate: string;
};

type ReportExecutiveSummary = {
  totalStudents: number;
  totalMealOptins: number;
  avgRating: string;
  leftoverStats: ReportLeftoverStats;
  monthlyBudget: number;
  actualSpend: number;
  remainingBudget: number;
  budgetUtilization: string;
};

type ReportRatedMeal = {
  name: string;
  rating: string;
};

type MealAttendanceStats = {
  meal_type: string;
  count: number;
  percentage: number;
};

type LeftoverDetail = {
  meal_type: string;
  dish_name: string;
  total_portions: number;
  claimed_count: number;
  expired_count: number;
};

type SustainabilityImpact = {
  portions_saved: number;
  estimated_waste_prevented_kg: number;
  estimated_co2_reduction_kg: number;
};

type PerformanceScorecard = {
  attendance: string;
  satisfaction: string;
  budget_control: string;
  waste_reduction: string;
  overall_grade: string;
};

export type ReportData = {
  executiveSummary: ReportExecutiveSummary;
  meal_attendance: MealAttendanceStats[];
  attendanceTrends: AttendanceTrend[];
  topRatedMeals: ReportRatedMeal[];
  lowestRatedMeals: ReportRatedMeal[];
  mostRequestedMeals: RequestedMeal[];
  leftover_details: LeftoverDetail[];
  wasteBreakdown: WasteBreakdown[];
  sustainability: SustainabilityImpact;
  insights: string[];
  scorecard: PerformanceScorecard;
};

export async function getReportData(date: string): Promise<ReportData> {
  console.log('[getReportData] Starting, date:', date);
  await ensureMysqlSchema();
  console.log('[getReportData] Schema ensured');
  const pool = getMysqlPool();
  const month = date.slice(0, 7);

  // 1. Executive Summary Data
  const [totalStudentsResult] = await pool.execute(`
    SELECT COUNT(*) as total FROM users WHERE role = 'student' AND account_status = 'approved'
  `) as any[];
  console.log('[getReportData] totalStudentsResult:', totalStudentsResult);
  const totalStudents = totalStudentsResult[0]?.total || 0;

  const [totalOptinsResult] = await pool.execute(`
    SELECT COUNT(*) as total FROM meal_optins
  `) as any[];
  console.log('[getReportData] totalOptinsResult:', totalOptinsResult);
  const totalMealOptins = totalOptinsResult[0]?.total || 0;

  const [avgRatingResult] = await pool.execute(`
    SELECT AVG(rating) as avgRating FROM meal_ratings
  `) as any[];
  console.log('[getReportData] avgRatingResult:', avgRatingResult);
  const avgRating = avgRatingResult[0]?.avgRating ? Number(avgRatingResult[0].avgRating).toFixed(1) : "No data";

  const [leftoverStatsResult] = await pool.execute(`
    SELECT 
      COUNT(*) as totalDeclarations, 
      SUM(total_portions) as totalPortionsDeclared, 
      SUM(claimed_count) as totalClaimed,
      (SUM(claimed_count) / NULLIF(SUM(total_portions), 0) * 100) as recoveryRate
    FROM leftover_items
  `) as any[];
  console.log('[getReportData] leftoverStatsResult:', leftoverStatsResult);
  const leftoverStats = {
    totalDeclarations: leftoverStatsResult[0]?.totalDeclarations || 0,
    totalPortionsDeclared: leftoverStatsResult[0]?.totalPortionsDeclared || 0,
    totalClaimed: leftoverStatsResult[0]?.totalClaimed || 0,
    recoveryRate: leftoverStatsResult[0]?.recoveryRate ? `${Number(leftoverStatsResult[0].recoveryRate).toFixed(0)}%` : "No data"
  };

  const [budgetResult] = await pool.execute(`
    SELECT monthly_budget FROM budget_settings
    WHERE hostel_id = 'A'
    ORDER BY effective_from DESC
    LIMIT 1
  `) as any[];
  console.log('[getReportData] budgetResult:', budgetResult);
  const monthlyBudget = budgetResult[0]?.monthly_budget || 0;

  const [spendResult] = await pool.execute(`
    SELECT COALESCE(SUM(total_cost), 0) as spend FROM procurement_purchases
    WHERE DATE_FORMAT(purchase_date, '%Y-%m') = ?
  `, [month]) as any[];
  console.log('[getReportData] spendResult:', spendResult);
  const actualSpend = spendResult[0]?.spend || 0;
  const remainingBudget = monthlyBudget - actualSpend;
  const budgetUtilization = monthlyBudget > 0 ? `${Number((actualSpend / monthlyBudget) * 100).toFixed(1)}%` : "No data";
  const budgetUtilizationNum = monthlyBudget > 0 ? Number((actualSpend / monthlyBudget) * 100) : 0;

  // 2. Attendance Trends (Weekly) AND Meal Type Stats
  const [attendanceTrends] = await pool.execute(`
    SELECT 
      DATE_FORMAT(meal_date, '%Y-%m-%d') as date,
      meal_type,
      COUNT(*) as count
    FROM meal_optins
    WHERE meal_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    GROUP BY DATE_FORMAT(meal_date, '%Y-%m-%d'), meal_type
    ORDER BY date
  `) as any[];
  console.log('[getReportData] attendanceTrends:', attendanceTrends);

  const [mealAttendance] = await pool.execute(`
    SELECT meal_type, COUNT(*) as count
    FROM meal_optins
    WHERE DATE_FORMAT(meal_date, '%Y-%m') = ?
    GROUP BY meal_type
  `, [month]) as any[];
  const totalMealAttendance = mealAttendance.reduce((acc: number, m: any) => acc + m.count, 0);
  const mealAttendanceStats: MealAttendanceStats[] = mealAttendance.map((m: any) => ({
    meal_type: m.meal_type,
    count: m.count,
    percentage: totalMealAttendance > 0 ? Number((m.count / totalMealAttendance) * 100).toFixed(0) : 0
  }));

  // 3. Menu Performance (Top and Lowest)
  const [topRatedMealsRaw] = await pool.execute(`
    SELECT dish_name, AVG(rating) as avgRating
    FROM meal_ratings
    WHERE dish_name IS NOT NULL
    GROUP BY dish_name
    ORDER BY avgRating DESC
    LIMIT 5
  `) as any[];
  console.log('[getReportData] topRatedMealsRaw:', topRatedMealsRaw);

  const [lowestRatedMealsRaw] = await pool.execute(`
    SELECT dish_name, AVG(rating) as avgRating
    FROM meal_ratings
    WHERE dish_name IS NOT NULL
    GROUP BY dish_name
    ORDER BY avgRating ASC
    LIMIT 5
  `) as any[];
  console.log('[getReportData] lowestRatedMealsRaw:', lowestRatedMealsRaw);

  // 4. Voting Analytics (Most requested meals)
  const [mostRequestedMeals] = await pool.execute(`
    SELECT dish_name, COUNT(*) as votes
    FROM meal_votes
    GROUP BY dish_name
    ORDER BY votes DESC
    LIMIT 5
  `) as any[];
  console.log('[getReportData] mostRequestedMeals:', mostRequestedMeals);

  // 5. Leftover Details
  const [leftoverDetailsRaw] = await pool.execute(`
    SELECT meal_type, dish_name, total_portions, claimed_count, 
           (total_portions - claimed_count) as expired_count
    FROM leftover_items
  `) as any[];
  console.log('[getReportData] leftoverDetailsRaw:', leftoverDetailsRaw);

  // 6. Waste logs
  const [wasteBreakdown] = await pool.execute(`
    SELECT meal_type, SUM(amount) as totalAmount
    FROM waste_logs
    WHERE DATE_FORMAT(log_date, '%Y-%m') = ?
    GROUP BY meal_type
  `, [month]) as any[];
  console.log('[getReportData] wasteBreakdown:', wasteBreakdown);

  // Calculate Sustainability Impact
  const portionsSaved = leftoverStats.totalClaimed || 0;
  const estimatedWasteKg = portionsSaved * 0.3; // ~300g per portion
  const estimatedCO2Kg = portionsSaved * 0.225; // ~225g CO2e per portion

  // Generate smarter insights
  const insights: string[] = [];
  if (mealAttendanceStats.length > 0) {
    const sortedAttendance = [...mealAttendanceStats].sort((a, b) => b.percentage - a.percentage);
    if (sortedAttendance.length >= 2) {
      const highest = sortedAttendance[0];
      const lowest = sortedAttendance[sortedAttendance.length - 1];
      insights.push(`${highest.meal_type} has the highest participation at ${highest.percentage}%`);
      const diff = Number(highest.percentage) - Number(lowest.percentage);
      if (diff > 10) {
        insights.push(`${highest.meal_type} participation exceeds ${lowest.meal_type} by ${diff}%. Consider adjusting preparation quantities.`);
      }
    }
  }
  const recoveryRateNum = leftoverStats.recoveryRate !== "No data" ? Number(leftoverStats.recoveryRate.replace('%', '')) : 0;
  if (recoveryRateNum > 0 && recoveryRateNum < 40) {
    insights.push(`Only ${recoveryRateNum}% of leftovers were recovered. Increase student notifications for leftover claims!`);
  } else if (recoveryRateNum > 70) {
    insights.push(`Excellent! ${recoveryRateNum}% of leftovers were recovered! Keep up the great work!`);
  } else if (recoveryRateNum > 40) {
    insights.push(`Leftover recovery at ${recoveryRateNum}%. Consider promoting leftover claims to reach 70%!`);
  }
  if (budgetUtilizationNum < 50 && monthlyBudget > 0) {
          insights.push(`Budget utilization is only ${budgetUtilizationNum.toFixed(1)}%. Current spending is well below the monthly allocation.`);
        } else if (budgetUtilizationNum > 90 && monthlyBudget > 0) {
          insights.push(`Budget utilization at ${budgetUtilizationNum.toFixed(1)}%. Be careful not to exceed the monthly limit!`);
        }
  if (mostRequestedMeals.length > 0) {
    insights.push(`"${simplifyMenuName(mostRequestedMeals[0].dish_name)}" is the most requested dish! Consider serving it more frequently!`);
  }

  const topRatedMeals = (topRatedMealsRaw as any[]).map((m: any) => ({
    name: simplifyMenuName(m.dish_name),
    rating: Number(m.avgRating).toFixed(1)
  }));
  
  const lowestRatedMeals = (lowestRatedMealsRaw as any[]).map((m: any) => ({
    name: simplifyMenuName(m.dish_name),
    rating: Number(m.avgRating).toFixed(1)
  }));

  const leftoverDetails: LeftoverDetail[] = (leftoverDetailsRaw as any[]).map((l: any) => ({
    meal_type: l.meal_type,
    dish_name: simplifyMenuName(l.dish_name),
    total_portions: l.total_portions,
    claimed_count: l.claimed_count,
    expired_count: l.expired_count
  }));

  // Calculate Scorecard
  function getGrade(value: number, type: 'percentage' | 'rating' | 'budget'): string {
    if (type === 'rating') {
      if (value >= 4.5) return 'A+';
      if (value >= 4.0) return 'A';
      if (value >= 3.5) return 'B';
      if (value >= 3.0) return 'C';
      return 'D';
    } else if (type === 'budget') {
      if (value <= 60) return 'A+';
      if (value <= 80) return 'A';
      if (value <= 95) return 'B';
      if (value <= 100) return 'C';
      return 'D';
    } else {
      if (value >= 85) return 'A';
      if (value >= 70) return 'B';
      if (value >= 50) return 'C';
      return 'D';
    }
  }

  const avgRatingNum = avgRating !== "No data" ? Number(avgRating) : 0;
  const attendanceGrade = getGrade(88, 'percentage'); // Using placeholder since we don't have % enrolled
  const satisfactionGrade = getGrade(avgRatingNum, 'rating');
  const budgetGrade = getGrade(budgetUtilizationNum, 'budget');
  const wasteGrade = getGrade(recoveryRateNum, 'percentage');
  
  // Calculate overall grade
  const gradeToScore: Record<string, number> = { 'A+': 4.3, 'A': 4.0, 'B': 3.0, 'C': 2.0, 'D': 1.0 };
  const avgScore = (
    gradeToScore[attendanceGrade] + 
    gradeToScore[satisfactionGrade] + 
    gradeToScore[budgetGrade] + 
    gradeToScore[wasteGrade]
  ) / 4;
  
  const overallGrade = avgScore >= 4.0 ? 'A+' : 
                       avgScore >= 3.8 ? 'A' : 
                       avgScore >= 3.0 ? 'B' : 
                       avgScore >= 2.0 ? 'C' : 'D';

  return {
    executiveSummary: {
      totalStudents,
      totalMealOptins,
      avgRating,
      leftoverStats,
      monthlyBudget,
      actualSpend,
      remainingBudget,
      budgetUtilization
    },
    meal_attendance: mealAttendanceStats,
    attendanceTrends,
    topRatedMeals,
    lowestRatedMeals,
    mostRequestedMeals: mostRequestedMeals.map((m: any) => ({
      ...m,
      dish_name: simplifyMenuName(m.dish_name)
    })),
    leftover_details: leftoverDetails,
    wasteBreakdown,
    sustainability: {
      portions_saved: portionsSaved,
      estimated_waste_prevented_kg: Number(estimatedWasteKg.toFixed(1)),
      estimated_co2_reduction_kg: Number(estimatedCO2Kg.toFixed(1))
    },
    insights: insights.length > 0 ? insights : ["No specific insights yet! Keep using MessMate for smart recommendations!"],
    scorecard: {
      attendance: attendanceGrade,
      satisfaction: satisfactionGrade,
      budget_control: budgetGrade,
      waste_reduction: wasteGrade,
      overall_grade: overallGrade
    }
  };
}
