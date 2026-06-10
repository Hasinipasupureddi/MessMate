'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRealtimeMealOptins } from '@/hooks/useRealtimeMealOptins';
import { getIstDateString, getMealStatus } from '@/lib/utils/mealStatus';

interface MealOptIn {
  id: string;
  meal: string;
  mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner';
  emoji: string;
  confirmed: number;
  vegConfirmed: number;
  nonVegConfirmed: number;
  predicted: number;
  deadline: string;
  isActive: boolean;
  isApproved?: boolean;
  votes: number;
  portions?: Array<{ label: string; pct: number; count: number; dietPreference?: string }>;
}

const MEAL_CONFIG: Omit<MealOptIn, 'id' | 'confirmed' | 'vegConfirmed' | 'nonVegConfirmed' | 'predicted'>[] = [
  { meal: 'Breakfast', mealType: 'breakfast', emoji: '🌅', deadline: '6:30 AM', isActive: false, votes: 0 },
  { meal: 'Lunch', mealType: 'lunch', emoji: '☀️', deadline: '11:00 AM', isActive: true, votes: 0 },
  { meal: 'Snack', mealType: 'snack', emoji: '🍪', deadline: '4:30 PM', isActive: true, votes: 0 },
  { meal: 'Dinner', mealType: 'dinner', emoji: '🌙', deadline: '5:00 PM', isActive: true, votes: 0 },
];

export default function LiveOptInCounter() {
  const tomorrowDate = getIstDateString(1);
  const [data, setData] = useState<MealOptIn[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);

  const loadMeals = useCallback(async () => {
    try {
      const response = await fetch(`/api/meals?date=${tomorrowDate}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.log('Load meals error:', payload?.message || 'request failed');
        return;
      }

      const rows = Array.isArray(payload?.rows) ? payload.rows : [];
      const order: Array<'breakfast' | 'lunch' | 'snack' | 'dinner'> = ['breakfast', 'lunch', 'snack', 'dinner'];
      const byName = new Map<string, any>();
      rows.forEach((r: any) => byName.set(String(r.name), r));

      const built = order.map((name) => {
        const row = byName.get(name);
        const config = MEAL_CONFIG.find((item) => item.mealType === name) ?? MEAL_CONFIG[0];
        return {
          id: row?.id ?? `meal-${name}`,
          meal: config.meal,
          mealType: name,
          emoji: config.emoji,
          confirmed: 0,
          vegConfirmed: 0,
          nonVegConfirmed: 0,
          predicted: totalStudents || 0,
          deadline: config.deadline,
          isActive: getMealStatus(name) === 'open',
          votes: 0,
        };
      });

      setData(built);
    } catch (err: any) {
      console.log('Load meals error:', err.message);
    }
  }, [tomorrowDate, totalStudents]);

  const loadCounts = useCallback(async () => {
    try {
      // 1. Fetch real attendance from meal-optins
      const optinResponse = await fetch(`/api/meal-optins?date=${tomorrowDate}`);
      const optinPayload = await optinResponse.json().catch(() => ({}));
      
      // 2. Fetch vote counts and menu status from meal-votes
      const voteResponse = await fetch(`/api/meal-votes?date=${tomorrowDate}`);
      const votePayload = await voteResponse.json().catch(() => ({}));
      
      // 3. Fetch approved winners for portion calculation
      const menuResponse = await fetch(`/api/live/final-menu?date=${tomorrowDate}`);
      const menuPayload = await menuResponse.json().catch(() => ({}));

      const mealCounts: Record<string, { total: number; veg: number; nonVeg: number }> = {};
      (optinPayload?.rows ?? []).forEach((row: any) => {
        mealCounts[String(row.meal_type)] = {
          total: Number(row.confirmed || 0),
          veg: Number(row.veg_confirmed || 0),
          nonVeg: Number(row.non_veg_confirmed || 0),
        };
      });

      const menu = menuPayload?.menu || {};
      const mealWinners = Array.isArray(menu?.meals) ? menu.meals : [];
      const menuIsApproved = menu?.status === 'approved';
      const voteParticipation = votePayload?.participation || {};

      setData(prev => prev.map((meal) => {
        const counts = mealCounts[meal.mealType] || { total: 0, veg: 0, non_veg: 0 };
        const votes = voteParticipation[meal.mealType] || 0;
        const winner = mealWinners.find((w: any) => w.mealType === meal.mealType);
        const winningItems = Array.isArray(winner?.winningItems) ? winner.winningItems : [];
        
        let portions = [];
        if (menuIsApproved && winningItems.length > 0) {
          portions = winningItems.map((item: any) => {
            const dietPref = item.dietPreference;
            let count = 0;

            if (dietPref === 'veg') {
              count = counts.veg;
            } else if (dietPref === 'non_veg') {
              count = counts.nonVeg;
            } else {
              count = counts.total;
            }

            return {
              label: item.label,
              pct: counts.total > 0 ? Math.round((count / counts.total) * 100) : 0,
              count,
              dietPreference: dietPref
            };
          });
        }

        return {
          ...meal,
          confirmed: counts.total,
          vegConfirmed: counts.veg,
          nonVegConfirmed: counts.nonVeg,
          portions,
          isApproved: menuIsApproved,
          votes // store for rendering
        };
      }));
    } catch (err: any) {
      console.log('Load counts error:', err.message);
    }
  }, [tomorrowDate]);

  useEffect(() => {
    // Fetch registered student count for denominator
    (async () => {
      try {
        const res = await fetch(`/api/live/final-menu?date=${tomorrowDate}`);
        const payload = await res.json().catch(() => ({}));
        if (payload?.totalStudents) {
          setTotalStudents(Number(payload.totalStudents));
        }
      } catch { /* non-blocking */ }
    })();
  }, [tomorrowDate]);

  useEffect(() => {
    void loadMeals();
  }, [loadMeals]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  useRealtimeMealOptins({
    mealIds: data.map((meal) => meal.id),
    onChange: loadCounts,
  });

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-white">Tomorrow Confirmed Attendance</h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Confirmed opt-ins for tomorrow's menu</p>
        </div>
        <div className="flex items-center gap-1.5 bg-green-500/12 border border-green-500/25 px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-slow" />
          <span className="text-xs font-semibold text-green-400">Live</span>
        </div>
      </div>

      <div className="space-y-4">
        {data.map(meal => {
          const pct = Math.round((meal.confirmed / meal.predicted) * 100);
          return (
            <div key={meal.id}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{meal.emoji}</span>
                  <span className="text-sm font-semibold text-white">{meal.meal}</span>
                  {meal.isActive && (
                    <span className="text-xs bg-cyan-500/15 text-cyan-400 px-1.5 py-0.5 rounded-full">Active</span>
                  )}
                </div>
                <div className="text-right">
                  {!meal.isApproved ? (
                    <div className="space-y-1">
                      <div className="text-[10px] text-amber-400 font-medium">Voting in Progress</div>
                      <div className="text-[11px] font-bold text-white flex items-center justify-end gap-1.5">
                        <span className="text-indigo-400">🗳️ {meal.votes}</span>
                        <span className="text-white/30 text-[10px]">voters</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-xs text-green-400 font-medium">🥬 {meal.vegConfirmed}</span>
                        <span className="text-xs text-red-400 font-medium">🍗 {meal.nonVegConfirmed}</span>
                        <span className="text-sm font-bold font-mono text-white ml-2">{meal.confirmed}</span>
                      </div>
                      <div className="text-[10px] text-[hsl(var(--muted-foreground))]">/{meal.predicted} total students</div>
                    </>
                  )}
                </div>
              </div>
              
              {meal.isApproved ? (
                <>
                  <div className="progress-bar mb-1">
                    <div
                      className="progress-fill transition-all duration-1000"
                      style={{
                        width: `${pct}%`,
                        background: pct >= 90 ? '#22c55e' : pct >= 70 ? '#06b6d4' : '#f59e0b',
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))]">
                    <span>Deadline: {meal.deadline}</span>
                    <span className="font-mono">{pct}% confirmed</span>
                  </div>
                </>
              ) : (
                <div className="text-[10px] text-white/30 italic">Attendance tracking opens after menu is approved.</div>
              )}
              
              {meal.isApproved && meal.portions && meal.portions.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {meal.portions.map((p, idx) => (
                    <div key={`${p.label}-${idx}`} className="bg-white/5 border border-white/10 rounded-lg p-2">
                      <div className="text-[10px] text-white/50 truncate uppercase tracking-wider">{p.label}</div>
                      <div className="flex items-end justify-between mt-1">
                        <span className="text-sm font-bold text-white">{p.count}</span>
                        <span className="text-[10px] text-indigo-400 font-mono">{p.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}