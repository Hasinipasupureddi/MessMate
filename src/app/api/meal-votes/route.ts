import { NextResponse } from 'next/server';
import { getIstDateString, getIstNow } from '@/lib/utils/mealStatus';
import { getVotes, saveVotes } from '@/lib/api/mealVotesMySQL';
import { requireAuth, requireRole } from '@/lib/auth/guards';
import { emitRealtimeEvent, SOCKET_EVENTS } from '@/lib/socket/bridge';
import type { VoteMealType } from '@/lib/menu/votingBlueprints';

type MealType = VoteMealType;

type VotePayload = {
  student_id?: string;
  studentId?: string;
  vote_date?: string;
  voteDate?: string;
  meal_date?: string;
  mealDate?: string;
  meal_type?: MealType;
  mealType?: MealType;
  dish_option_id?: string;
  dishOptionId?: string;
  dish_name?: string;
  dishName?: string;
};

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || getIstDateString();
    const studentId = url.searchParams.get('studentId');

    const result = await getVotes(date, studentId ?? undefined);
    if (studentId) {
      return NextResponse.json({ rows: result });
    } else {
      return NextResponse.json(result);
    }
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return PUT(request);
}

export async function PUT(request: Request) {
  const auth = await requireRole(request, ['student']);
  if (!auth.ok) {
    return auth.response;
  }

  // Server-side voting deadline enforcement (10:00 PM IST)
  const istNow = getIstNow();
  const hours = istNow.getUTCHours();
  
  // If it's 10:00 PM or later (22:00+)
  if (hours >= 22) {
    return NextResponse.json(
      { message: 'Voting for tomorrow\'s menu is closed. No new votes are accepted after 10:00 PM IST.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const votes = Array.isArray(body?.votes) ? (body.votes as VotePayload[]) : [];
    const clearCategories = Array.isArray(body?.clearCategories) ? body.clearCategories : undefined;

    if (votes.length === 0 && (!clearCategories || clearCategories.length === 0)) {
      return NextResponse.json({ message: 'No votes or clearCategories provided.' }, { status: 400 });
    }

    const studentId = auth.session.sub;
    const firstVote = votes[0];
    const voteDate = String(
      body.voteDate ?? 
      body.vote_date ?? 
      firstVote?.vote_date ?? 
      firstVote?.voteDate ?? 
      firstVote?.meal_date ?? 
      firstVote?.mealDate ?? 
      getIstDateString()
    );

    const sanitizedVotes = votes.map((vote) => ({
      ...vote,
      student_id: studentId,
      studentId: studentId,
    }));

    await saveVotes(studentId, voteDate, sanitizedVotes, clearCategories);
    const aggregateRows = await getVotes(voteDate);

    void emitRealtimeEvent(
      SOCKET_EVENTS.mealVotesSubmitted,
      {
        voteDate,
        studentId: auth.session.sub,
        votes: sanitizedVotes.map((vote) => ({
          mealType: vote.meal_type ?? vote.mealType,
          dishName: vote.dish_name ?? vote.dishName,
        })),
        aggregates: aggregateRows,
      },
      {
        roles: ['student', 'staff', 'warden'],
        sender: {
          userId: auth.session.sub,
          role: auth.session.role,
          hostelId: auth.session.hostelId,
        },
      }
    );

    void emitRealtimeEvent(
      SOCKET_EVENTS.notificationsUpdated,
      {
        userId: auth.session.sub,
        message: 'Your menu vote has been saved.',
        severity: 'success',
      },
      {
        rooms: [`user:${auth.session.sub}`],
        sender: {
          userId: auth.session.sub,
          role: auth.session.role,
          hostelId: auth.session.hostelId,
        },
      }
    );

    void emitRealtimeEvent(
      SOCKET_EVENTS.analyticsRefresh,
      { reason: 'meal-votes-submitted', voteDate },
      {
        roles: ['staff', 'warden'],
        sender: {
          userId: auth.session.sub,
          role: auth.session.role,
          hostelId: auth.session.hostelId,
        },
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}
