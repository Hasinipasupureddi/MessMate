import { NextResponse } from 'next/server';
import { getIstDateString } from '@/lib/utils/mealStatus';
import { requireRole } from '@/lib/auth/guards';
import { getRatings, saveRating, updateRating, getDishRatingAggregates, getDailyRatingTrend, getMealTypeRatingAverages, normalizeDishName } from '@/lib/api/mealRatingsMySQL';

export async function GET(request: Request) {
  const auth = await requireRole(request, ['student', 'staff', 'warden']);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || getIstDateString();
    const aggregate = url.searchParams.get('aggregate');

// Aggregate modes for dashboard charts
  if (aggregate === 'dish') {
    const dateParam = url.searchParams.get('date') || undefined;
    const ratings = await getDishRatingAggregates(dateParam);
    return NextResponse.json({
      ratings: ratings.map(r => ({
        dishName: r.dish_name,
        avgRating: Number(r.avg_rating).toFixed(1),
        votes: r.rating_count,
        emoji: '🍽️',
      })),
    });
  }

  if (aggregate === 'trend') {
    const trend = await getDailyRatingTrend(7);
    return NextResponse.json({ trend: trend.map((row) => ({
      date: row.rating_date,
      avgRating: Number(row.avg_rating.toFixed(1)),
      totalRatings: row.total_ratings,
    })) });
  }

  if (aggregate === 'meal-type') {
    const dateParam = url.searchParams.get('date') || undefined;
    const mealTypeRatings = await getMealTypeRatingAverages(14, dateParam);
    return NextResponse.json({ mealTypeRatings: mealTypeRatings.map((row) => ({
      mealType: row.meal_type,
      avgRating: Number(row.avg_rating.toFixed(1)),
      totalRatings: row.total_ratings,
    })) });
    }

    const studentId = url.searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json({ rows: [] });
    }

    return NextResponse.json({ rows: await getRatings(studentId, date) });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireRole(request, ['student']);
    if (!auth.ok) {
      return auth.response;
    }

    const body = await request.json();
    const ratingDate = String(body?.ratingDate ?? '').trim() || getIstDateString();
    const mealType = String(body?.mealType ?? '') as 'breakfast' | 'lunch' | 'snack' | 'dinner';
    const dishName = normalizeDishName(String(body?.dishName ?? ''));
    const rating = Number(body?.rating ?? 0);
    const wasteAmount = String(body?.wasteAmount ?? 'none');

    if (!ratingDate || !mealType || !dishName || !rating) {
      return NextResponse.json({ message: 'Invalid rating payload.' }, { status: 400 });
    }

    await saveRating({
      studentId: auth.session.sub,
      ratingDate,
      mealType,
      dishName,
      rating,
      wasteAmount,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireRole(request, ['student']);
    if (!auth.ok) {
      return auth.response;
    }

    const body = await request.json();
    const ratingDate = String(body?.ratingDate ?? '').trim() || getIstDateString();
    const mealType = String(body?.mealType ?? '') as 'breakfast' | 'lunch' | 'snack' | 'dinner';
    const dishName = body?.dishName ? normalizeDishName(String(body.dishName)) : undefined;
    const rating = body?.rating !== undefined ? Number(body.rating) : undefined;
    const wasteAmount = body?.wasteAmount !== undefined ? String(body.wasteAmount) : undefined;

    if (!ratingDate || !mealType || (rating === undefined && dishName === undefined && wasteAmount === undefined)) {
      return NextResponse.json({ message: 'Invalid rating payload.' }, { status: 400 });
    }

    await updateRating({
      studentId: auth.session.sub,
      ratingDate,
      mealType,
      dishName,
      rating,
      wasteAmount,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}