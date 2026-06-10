'use client';

import React, { useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const FALLBACK_MONTHLY_WASTE = [
  { month: 'Jan', waste: 79.3, target: 75 },
  { month: 'Feb', waste: 74.8, target: 75 },
  { month: 'Mar', waste: 62.1, target: 70 },
  { month: 'Apr', waste: 58.4, target: 70 },
  { month: 'May', waste: 54.2, target: 65 },
  { month: 'Jun', waste: 48.7, target: 65 },
];

const FALLBACK_MEAL_WASTE = [
  { meal: 'Breakfast', waste: 18.4, percentage: 29.6, color: '#06b6d4' },
  { meal: 'Lunch', waste: 28.7, percentage: 46.2, color: '#6366f1' },
  { meal: 'Dinner', waste: 15.0, percentage: 24.2, color: '#a78bfa' },
];

const FALLBACK_DAILY_WASTE_WEEK = [
  { day: 'Mon', breakfast: 3.2, lunch: 5.1, dinner: 2.8 },
  { day: 'Tue', breakfast: 2.9, lunch: 4.7, dinner: 2.4 },
  { day: 'Wed', breakfast: 2.1, lunch: 3.9, dinner: 1.8 },
  { day: 'Thu', breakfast: 3.8, lunch: 5.6, dinner: 3.1 },
  { day: 'Fri', breakfast: 2.5, lunch: 4.2, dinner: 2.2 },
  { day: 'Sat', breakfast: 3.1, lunch: 4.8, dinner: 2.6 },
  { day: 'Sun', breakfast: 1.8, lunch: 3.5, dinner: 1.9 },
];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-2.5 text-xs shadow-xl border border-white/12">
        <p className="text-white font-semibold mb-1">{label}</p>
        {payload.map((entry, i) => (
          <p key={`tt-${i}`} style={{ color: entry.color }} className="font-mono">
            {entry.name}: {entry.value}kg
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const AreaTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string; dataKey: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-2.5 text-xs shadow-xl border border-white/12">
        <p className="text-white font-semibold mb-1">{label}</p>
        {payload.map((entry, i) => (
          <p key={`at-${i}`} style={{ color: entry.color }} className="font-mono">
            {entry.dataKey === 'target' ? 'Target' : 'Actual'}: {entry.value}kg
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function FoodWasteChart() {
  const [hasMounted, setHasMounted] = useState(false);
  const [view, setView] = useState<'monthly' | 'weekly'>('monthly');
  const [dailyData, setDailyData] = useState<any[] | null>(null);
  const [mealBreakdown, setMealBreakdown] = useState<any[] | null>(null);
  const [totalWaste, setTotalWaste] = useState<number | null>(null);

  const computedMealWaste = mealBreakdown ?? FALLBACK_MEAL_WASTE;
  const totalWasteComputed = totalWaste ?? computedMealWaste.reduce((s, m) => s + (m.waste || 0), 0);

  useEffect(() => {
    setHasMounted(true);
    let mounted = true;
    (async () => {
      try {
        const range = view === 'monthly' ? 30 : 7;
        const res = await fetch(`/api/waste-logs/aggregate?range=${range}`);
        if (!mounted) return;
        if (!res.ok) return;
        const payload = await res.json().catch(() => ({}));
        if (!payload) return;
        if (Array.isArray(payload.daily) && payload.daily.length) {
          // convert daily rows to chart-friendly format (weekday labels)
          const days = payload.daily.map((d: any) => {
            const dt = new Date(`${d.date}T00:00:00.000Z`);
            const day = dt.toLocaleDateString('en-IN', { weekday: 'short' });
            return { day, breakfast: d.breakfast || 0, lunch: d.lunch || 0, dinner: d.dinner || 0 };
          });
          setDailyData(days);
        }
        if (Array.isArray(payload.mealBreakdown)) {
          const mapped = payload.mealBreakdown.map((m: any) => ({
            meal: m.meal || m.meal_type || m.mealType,
            waste: Number(m.waste || 0),
            percentage: Number(m.percentage || 0),
            color: m.color || undefined
          }));
          setMealBreakdown(mapped);
        }
        if (typeof payload.total === 'number') setTotalWaste(Number(payload.total));
      } catch (e) {
        // ignore — fallback data will be used
      }
    })();
    return () => { mounted = false; };
  }, [view]);

  if (!hasMounted) {
    return (
      <div className="glass-card p-5 h-[300px] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Monthly Trend */}
      <div className="glass-card p-[18px] sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white">Food Waste Trend</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Monthly waste vs target (kg)</p>
          </div>
          <div className="flex gap-1.5">
            {(['monthly', 'weekly'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 rounded-[0.8rem] text-xs font-semibold transition-all ${
                  view === v ? 'tab-active' : 'bg-white/4 border border-white/8 text-white/55 hover:bg-white/7'
                }`}
              >
                {v === 'monthly' ? '6 Months' : 'This Week'}
              </button>
            ))}
          </div>
        </div>

        {view === 'monthly' ? (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={FALLBACK_MONTHLY_WASTE} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="wasteGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f87171" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#f87171" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="targetGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<AreaTooltip />} />
                <Area type="monotone" dataKey="target" name="Target" stroke="#22c55e" strokeWidth={2} strokeDasharray="5 3" fill="url(#targetGrad)" dot={false} />
                <Area type="monotone" dataKey="waste" name="Actual" stroke="#f87171" strokeWidth={2.5} fill="url(#wasteGrad)" dot={{ fill: '#f87171', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-3 flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-red-400 inline-block" /><span className="text-white/60">Actual Waste</span></span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-green-400 inline-block border-dashed" /><span className="text-white/60">Target</span></span>
            </div>
          </>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyData ?? FALLBACK_DAILY_WASTE_WEEK} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }} />
              <Bar dataKey="breakfast" name="Breakfast" stackId="a" fill="#06b6d4" radius={[0, 0, 0, 0]} />
              <Bar dataKey="lunch" name="Lunch" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
              <Bar dataKey="dinner" name="Dinner" stackId="a" fill="#a78bfa" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Meal-wise Breakdown */}
          <div className="glass-card p-[18px] sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white">Waste by Meal</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">This month breakdown — {totalWasteComputed.toFixed(1)}kg total</p>
          </div>
          <div className="text-2xl">🗑️</div>
        </div>
          <div className="space-y-4">
          {(computedMealWaste).map((m: any) => (
            <div key={`meal-${m.meal}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-white/80 font-medium">{m.meal}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[hsl(var(--muted-foreground))] font-mono">{m.percentage ?? Math.round(((Number(m.waste) || 0) / (totalWasteComputed || 1)) * 100)}%</span>
                  <span className="text-sm font-bold font-mono text-white">{`${Number(m.waste || 0).toFixed(1)}kg`}</span>
                </div>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${m.percentage ?? Math.round(((Number(m.waste) || 0) / (totalWasteComputed || 1)) * 100)}%`, background: m.color || '#6366f1' }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3.5 p-3 rounded-[0.85rem] bg-amber-500/8 border border-amber-500/18">
          <p className="text-xs text-amber-400 font-semibold mb-0.5">⚠️ Insight</p>
          <p className="text-xs text-white/60">Lunch accounts for a large share of total waste. Consider reducing portion sizes for rice-based dishes on weekdays.</p>
        </div>
      </div>
    </div>
  );
}

