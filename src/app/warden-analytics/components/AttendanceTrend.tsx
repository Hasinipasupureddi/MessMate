'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
  BarChart
} from 'recharts';
import { getIstDateString } from '@/lib/utils/mealStatus';

type DailyAttendance = {
  day: string;
  breakfast: number;
  lunch: number;
  snack: number;
  dinner: number;
  capacity: number;
};

type MonthlyAttendance = {
  month: string;
  optins: number;
  rate: number;
  totalCapacity: number;
};

type MealStatSummary = {
  id: string;
  meal: string;
  avg: number;
  rate: number;
  icon: string;
  color: string;
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-2.5 text-xs shadow-xl border border-white/12">
        <p className="text-white font-semibold mb-1">{label}</p>
        {payload.map((entry, i) => (
          <p key={`att-${i}`} style={{ color: entry.color }} className="font-mono">
            {entry.name}: {typeof entry.value === 'number' && entry.value < 100 ? `${entry.value}%` : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AttendanceTrends() {
  const [hasMounted, setHasMounted] = useState(false);
  const today = getIstDateString();
  const sevenDaysAgo = getIstDateString(-6);
  const [view, setView] = useState<'weekly' | 'monthly'>('weekly');
  const [weeklyData, setWeeklyData] = useState<DailyAttendance[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);

  const formatDayLabel = (date: string) =>
    new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en-IN', {
      timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short'
    });

  const formatMonthLabel = (year: number, monthIndex: number) =>
    new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString('en-IN', {
      timeZone: 'UTC', month: 'short', year: 'numeric'
    });

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, menuRes] = await Promise.all([
        fetch(`/api/meals/stats?startDate=${sevenDaysAgo}&endDate=${today}`),
        fetch(`/api/live/final-menu?date=${today}`),
      ]);

      const statsPayload = await statsRes.json().catch(() => ({}));
      const menuPayload = await menuRes.json().catch(() => ({}));
      const rows = Array.isArray(statsPayload?.rows) ? statsPayload.rows : [];
      const students = Number(menuPayload?.totalStudents || 0);

      console.log(`[AttendanceTrends] Data Debug: rows=${rows.length}, totalStudents=${students}`);
      if (rows.length > 0) {
        const uniqueDays = new Set(rows.map((r: any) => r.meal_date || r.mealDate)).size;
        const totalConfirmed = rows.reduce((acc: number, r: any) => acc + Number(r.attending_or_takeaway ?? r.confirmed ?? 0), 0);
        console.log(`[AttendanceTrends] Stats: uniqueDays=${uniqueDays}, totalConfirmed=${totalConfirmed}`);
      }

      setTotalStudents(students);

      const weekMap = new Map<string, DailyAttendance>();
      for (let i = 0; i < 7; i++) {
        const date = getIstDateString(-6 + i);
        weekMap.set(date, {
          day: formatDayLabel(date),
          breakfast: 0,
          lunch: 0,
          snack: 0,
          dinner: 0,
          capacity: students || 240,
        });
      }

      rows.forEach((row: any) => {
        let date = row.meal_date || row.mealDate;
        if (date instanceof Date) {
          date = date.toISOString().split('T')[0];
        } else {
          date = String(date || '').split('T')[0];
        }

        const mealType = String(row.meal_type || row.mealType || '');
        const confirmed = Number(row.attending_or_takeaway ?? row.confirmed ?? 0);
        const entry = weekMap.get(date);
        if (entry && ['breakfast', 'lunch', 'snack', 'dinner'].includes(mealType)) {
          entry[mealType as keyof Omit<DailyAttendance, 'day' | 'capacity'>] = confirmed;
        }
      });

      setWeeklyData(Array.from(weekMap.values()));

      const monthMap = new Map<string, { year: number; monthIndex: number; optins: number; days: Set<string> }>();
      rows.forEach((row: any) => {
        let date = row.meal_date || row.mealDate;
        let dt: Date;
        if (date instanceof Date) {
          dt = date;
          date = date.toISOString().split('T')[0];
        } else {
          date = String(date || '').split('T')[0];
          dt = new Date(`${date}T00:00:00.000Z`);
        }

        const confirmed = Number(row.attending_or_takeaway ?? row.confirmed ?? 0);
        if (!date || isNaN(dt.getTime())) return;
        
        const key = `${dt.getUTCFullYear()}-${dt.getUTCMonth()}`;
        const existing = monthMap.get(key) || { year: dt.getUTCFullYear(), monthIndex: dt.getUTCMonth(), optins: 0, days: new Set<string>() };
        existing.optins += confirmed;
        existing.days.add(date);
        monthMap.set(key, existing);
      });

      const monthlyRows = Array.from(monthMap.values()).sort((a, b) =>
        a.year === b.year ? a.monthIndex - b.monthIndex : a.year - b.year
      ).map((item) => {
        const days = item.days.size || 1;
        const totalPossible = students > 0 ? students * days * 4 : 0;
        const rate = totalPossible > 0 ? Math.min(100, Math.round((item.optins / totalPossible) * 100)) : 0;

        return {
          month: formatMonthLabel(item.year, item.monthIndex),
          optins: item.optins,
          rate,
          totalCapacity: totalPossible,
        };
      });

      setMonthlyData(monthlyRows);
    } catch {
      setWeeklyData([]);
      setMonthlyData([]);
    } finally {
      setLoading(false);
    }
  }, [sevenDaysAgo, today]);

  useEffect(() => {
    setHasMounted(true);
    void loadAttendance();
  }, [loadAttendance]);

  // Threshold logic: Show analytics if we have any data, or show demo baseline for presentation
  const hasMealStats = useMemo(() => {
    const hasData = weeklyData.some(day => (day.breakfast + day.lunch + day.snack + day.dinner) > 0);
    // If it's a project demo, we always want to show the chart structure
    return true; 
  }, [weeklyData]);

  const mealStats = useMemo<MealStatSummary[]>(() => {
    if (totalStudents === 0) return [];

    const totals = weeklyData.reduce(
      (acc, row) => {
        acc.breakfast += row.breakfast;
        acc.lunch += row.lunch;
        acc.snack += row.snack;
        acc.dinner += row.dinner;
        return acc;
      },
      { breakfast: 0, lunch: 0, snack: 0, dinner: 0 }
    );

    const days = weeklyData.length || 1;
    return [
      {
        id: 'ms-b',
        meal: 'Breakfast',
        avg: Math.round(totals.breakfast / days),
        rate: Math.min(100, Math.round((totals.breakfast / days / totalStudents) * 100)),
        icon: '🌅',
        color: '#06b6d4',
      },
      {
        id: 'ms-l',
        meal: 'Lunch',
        avg: Math.round(totals.lunch / days),
        rate: Math.min(100, Math.round((totals.lunch / days / totalStudents) * 100)),
        icon: '☀️',
        color: '#6366f1',
      },
      {
        id: 'ms-s',
        meal: 'Snack',
        avg: Math.round(totals.snack / days),
        rate: Math.min(100, Math.round((totals.snack / days / totalStudents) * 100)),
        icon: '🍪',
        color: '#22c55e',
      },
      {
        id: 'ms-d',
        meal: 'Dinner',
        avg: Math.round(totals.dinner / days),
        rate: Math.min(100, Math.round((totals.dinner / days / totalStudents) * 100)),
        icon: '🌙',
        color: '#a78bfa',
      },
    ];
  }, [hasMealStats, totalStudents, weeklyData]);

  if (!hasMounted) {
    return (
      <div className="glass-card p-5 h-[300px] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Meal Stats Summary */}
      {hasMealStats ? (
        <>
          <div className="grid grid-cols-3 gap-4">
          {mealStats.map(m => (
            <div key={m.id} className="glass-card p-3.5 text-center">
              <div className="text-2xl mb-2">{m.icon}</div>
              <div className="font-mono text-2xl font-bold text-white">{m.avg}</div>
              <div className="text-xs font-semibold text-white/70 mt-0.5">{m.meal}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">avg students</div>
              <div className="mt-2 progress-bar">
                <div className="progress-fill" style={{ width: `${m.rate}%`, background: m.color }} />
              </div>
              <div className="text-xs font-mono mt-1" style={{ color: m.color }}>{m.rate}% opt-in</div>
            </div>
          ))}
        </div>

        <div className="glass-card p-[18px] sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white">Attendance Trends</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Confirmed meal opt-ins from actual student attendance</p>
          </div>
          <div className="flex gap-1.5">
            {(['weekly', 'monthly'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 rounded-[0.8rem] text-xs font-semibold transition-all ${
                  view === v ? 'tab-active' : 'bg-white/4 border border-white/8 text-white/55 hover:bg-white/7'
                }`}
              >
                {v === 'weekly' ? 'This Week' : 'Monthly'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="h-56 rounded-[1rem] bg-white/5 border border-white/8 animate-pulse" />
        ) : view === 'weekly' ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={weeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }} />
              <Bar dataKey="breakfast" name="Breakfast" fill="#06b6d4" radius={[3, 3, 0, 0]} opacity={0.85} />
              <Bar dataKey="lunch" name="Lunch" fill="#6366f1" radius={[3, 3, 0, 0]} opacity={0.85} />
              <Bar dataKey="dinner" name="Dinner" fill="#a78bfa" radius={[3, 3, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={monthlyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }} />
              <Bar yAxisId="left" dataKey="optins" name="Confirmed Opt-ins" fill="#6366f1" radius={[4, 4, 0, 0]} opacity={0.7} />
              <Line yAxisId="right" type="monotone" dataKey="rate" name="Attendance Rate" stroke="#22d3ee" strokeWidth={2.5} dot={{ fill: '#22d3ee', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        <div className="mt-3 p-3 rounded-[0.85rem] bg-cyan-500/8 border border-cyan-500/18">
          <p className="text-xs text-cyan-400 font-semibold mb-0.5">📊 Insight</p>
          <p className="text-xs text-white/60">
            This chart is now driven by actual confirmed opt-ins from the database. Weekly values reflect student attendance across morning and evening meals, while monthly values show sustained participation against hostel capacity.
          </p>
        </div>
      </div>
        </>
      ) : (
        <div className="glass-card p-8 text-center">
          <div className="text-4xl mb-3">📉</div>
          <p className="text-sm font-semibold text-white/80 mb-2">Insufficient attendance data yet</p>
          <p className="text-xs text-white/50 max-w-md mx-auto">
            Collect at least one week of confirmed student opt-ins to unlock meal averages and trend charts. Until then, this view reflects live activity only.
          </p>
        </div>
      )}
    </div>
  );
}
