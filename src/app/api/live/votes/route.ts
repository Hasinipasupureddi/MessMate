import { NextResponse } from 'next/server';
import { getIstDateString } from '@/lib/utils/mealStatus';
import { getVotes } from '@/lib/api/mealVotesMySQL';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || getIstDateString();

    const resultRaw = await getVotes(date);
    const result = resultRaw as {
      rows: any[];
      totalStudents: number;
      totalUniqueVoters: number;
      participation: any;
    };
    return NextResponse.json({
      rows: result.rows,
      totalStudents: result.totalStudents,
      totalUniqueVoters: result.totalUniqueVoters,
      participation: result.participation,
    });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 });
  }
}
