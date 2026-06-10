'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarRange, TrendingUp } from 'lucide-react';
import { getIstDateString } from '@/lib/utils/mealStatus';

type VoteRow = {
  mealType: 'breakfast' | 'lunch';
  menuOption: string;
  option: string;
  votes: number;
};

type DayTopVote = {
  date: string;
  label: string;
  topOption: string;
  mealType: string;
  votes: number;
  totalVotes: number;
  uniqueVoters: number;
  participation: number;
};

type VoteApiResult = {
  rows: VoteRow[];
  totalStudents?: number;
  totalUniqueVoters?: number;
};

const COLORS: Record<string, string> = {
  breakfast: '#818cf8',
  lunch: '#22d3ee',
};

function formatDayLabel(date: string) {
  return new Date(`${date}T00:00:00+05:30`).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

export default function WardenMenuVotesCard() {
  const [data, setData] = useState<DayTopVote[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadVotes = useCallback(async () => {
    try {
      const dates = Array.from({ length: 7 }, (_, index) => getIstDateString(index - 6));
      const [dayPayloads, kpiRes] = await Promise.all([
        Promise.all(
          dates.map(async date => {
            const response = await fetch(`/api/meal-votes?date=${date}`);
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              return { date, rows: [] as VoteRow[], totalUniqueVoters: 0, totalStudents: 0 };
            }

            return {
              date,
              rows: Array.isArray(payload?.rows) ? (payload.rows as VoteRow[]) : [],
              totalUniqueVoters: Number(payload?.totalUniqueVoters || 0),
              totalStudents: Number(payload?.totalStudents || 0),
            } as VoteApiResult & { date: string };
          })
        ),
        fetch('/api/warden/kpis')
      ]);

      const kpiData = await kpiRes.json().catch(() => ({}));
      setTotalStudents(kpiData?.totalStudents || 0);

      const mapped = dayPayloads
        .map(({ date, rows, totalUniqueVoters, totalStudents: payloadStudents }) => {
          const top = rows.slice().sort((a, b) => b.votes - a.votes)[0];
          if (!top) {
            return null;
          }

          const totalVotes = rows.reduce((sum, r) => sum + r.votes, 0);
          const studentCount = kpiData?.totalStudents || payloadStudents || 0;
          const participation = studentCount > 0
            ? Math.min(100, Math.round(((totalUniqueVoters ?? 0) / studentCount) * 100))
            : 0;

          return {
            date,
            label: formatDayLabel(date),
            topOption: top.option,
            mealType: top.mealType,
            votes: top.votes,
            totalVotes,
            uniqueVoters: totalUniqueVoters,
            participation,
          } as DayTopVote;
        })
        .filter(Boolean) as DayTopVote[];

      setData(mapped);
    } catch (error: any) {
      console.log('Load warden menu votes error:', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVotes();

    const id = window.setInterval(() => {
      void loadVotes();
    }, 60000);

    return () => {
      window.clearInterval(id);
    };
  }, [loadVotes]);

  const chartData = useMemo(
    () =>
      data.map(row => ({
        ...row,
        labelShort: row.label,
      })),
    [data]
  );

  return (
    <div className="glass-card p-[18px] sm:p-5 space-y-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white">Menu Votes</h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Top voted option for each of the last 7 days</p>
        </div>
        <div className="flex items-center gap-1.5 bg-indigo-500/12 border border-indigo-500/25 px-2.5 py-1 rounded-full text-indigo-300 text-xs font-semibold">
          <TrendingUp size={12} />
          {data.length} days
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-52 rounded-[1rem] bg-white/5 border border-white/8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="h-14 rounded-[1rem] bg-white/5" />
            <div className="h-14 rounded-[1rem] bg-white/5" />
          </div>
        </div>
      ) : chartData.length === 0 ? (
        <div className="rounded-[1rem] border border-white/8 bg-white/4 p-3.5 text-sm text-[hsl(var(--muted-foreground))]">
          No vote history available yet.
        </div>
      ) : (
        <>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="labelShort" stroke="rgba(255,255,255,0.35)" tick={{ fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.35)" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(15,23,42,0.96)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 12,
                    color: '#fff',
                  }}
                />
                <Bar dataKey="votes" radius={[8, 8, 0, 0]}>
                  {chartData.map(row => (
                    <Cell key={row.date} fill={COLORS[row.mealType] || '#818cf8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {chartData.map((row: any) => (
              <div key={row.date} className="rounded-[1rem] border border-white/8 bg-white/4 p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div>
                    <div className="text-xs text-white/45 uppercase tracking-wider font-semibold">{row.label}</div>
                    <div className="text-sm font-semibold text-white mt-1">{row.topOption}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold font-mono text-white">{row.votes}</div>
                    <div className="text-[10px] text-indigo-400 font-bold">{row.participation}% turnout</div>
                  </div>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${row.participation}%`, background: COLORS[row.mealType] || '#818cf8' }} />
                </div>
                <div className="mt-2 text-[10px] text-white/30 flex justify-between">
                  <span>{row.totalVotes} total votes</span>
                  <span>{row.uniqueVoters} voters</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            <CalendarRange size={12} />
            <span>Updated every 60 seconds</span>
          </div>
        </>
      )}
    </div>
  );
}
