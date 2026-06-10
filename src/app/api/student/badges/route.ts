import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { getIstDateString } from '@/lib/utils/mealStatus';
import { countStudentRatings } from '@/lib/api/mealRatingsMySQL';
import { countStudentVotes } from '@/lib/api/mealVotesMySQL';
import { countStudentLeftoverClaims } from '@/lib/api/leftoversMySQL';
import { getStudentOptinsInRange } from '@/lib/api/mealOptinsMySQL';

function buildDateWindow(days: number): string[] {
  return Array.from({ length: days }, (_, offset) => getIstDateString(-(days - 1 - offset)));
}

export async function GET(request: Request) {
  const auth = await requireRole(request, ['student']);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const studentId = auth.session.sub;
    const today = getIstDateString();
    const startDate = getIstDateString(-29);

    const [optinRows, ratingCount, voteCount, leftoverClaimCount] = await Promise.all([
      getStudentOptinsInRange(studentId, startDate, today),
      countStudentRatings(studentId),
      countStudentVotes(studentId),
      countStudentLeftoverClaims(studentId),
    ]);

    const optinDates = new Set(optinRows.map((row) => row.meal_date));
    let streakCount = 0;

    for (const date of buildDateWindow(30).reverse()) {
      if (!optinDates.has(date)) {
        break;
      }
      streakCount += 1;
    }

    const badges = [
      {
        id: 'badge-zerowaste',
        emoji: '🌱',
        name: 'Zero Waste',
        description: '7 clean days with no skipped opt-ins',
        earned: streakCount >= 7,
        progress: Math.min(100, Math.round((streakCount / 7) * 100)),
      },
      {
        id: 'badge-streak',
        emoji: '🔥',
        name: 'Streak Master',
        description: '10-day meal streak',
        earned: streakCount >= 10,
        progress: Math.min(100, Math.round((streakCount / 10) * 100)),
      },
      {
        id: 'badge-critic',
        emoji: '⭐',
        name: 'Food Critic',
        description: 'Rate 30 meals',
        earned: ratingCount >= 30,
        progress: Math.min(100, Math.round((ratingCount / 30) * 100)),
      },
      {
        id: 'badge-voter',
        emoji: '🗳️',
        name: 'Democracy',
        description: 'Vote 15 times',
        earned: voteCount >= 15,
        progress: Math.min(100, Math.round((voteCount / 15) * 100)),
      },
      {
        id: 'badge-influencer',
        emoji: '💫',
        name: 'Influencer',
        description: 'Top voter 3 times',
        earned: voteCount >= 9,
        progress: Math.min(100, Math.round((voteCount / 9) * 100)),
      },
      {
        id: 'badge-eco',
        emoji: '♻️',
        name: 'Eco Hero',
        description: 'Claim surplus before it is wasted',
        earned: leftoverClaimCount >= 5,
        progress: Math.min(100, Math.round((leftoverClaimCount / 5) * 100)),
      },
    ];

    const impact = [
      { value: `${(leftoverClaimCount * 0.25).toFixed(1)}kg`, label: 'Food Saved' },
      { value: `₹${leftoverClaimCount * 12}`, label: 'Cost Saved' },
      { value: `${(leftoverClaimCount * 0.08).toFixed(1)}kg`, label: 'CO₂ Reduced' },
    ];

    return NextResponse.json({
      badges,
      impact,
      summary: {
        streakCount,
        ratingCount,
        voteCount,
        leftoverClaimCount,
      },
    });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}