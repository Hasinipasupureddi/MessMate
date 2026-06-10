'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, Users, CheckCircle2, XCircle, Package, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  formatMealStatusLabel,
  getIstDateString,
  getIstTimeLabel,
  getIstNow,
  getMealStatus,
  type MealStatus as MealWindowStatus,
} from '@/lib/utils/mealStatus';
import { getTodayMenu } from '@/lib/menu/masterMenu';
import { cacheGeneratedMenuDay } from '@/lib/menu/generatedMenuCache';
import { useDietPreference } from '@/hooks/useDietPreference';

type OptInStatus = 'attending' | 'skip' | 'takeaway' | null;
type PortionSize = 'half' | 'full' | 'extra';

export default function TodayMealCards() {
  const { user } = useAuth();
  const dietPreference = useDietPreference();
  const todayMenu = useMemo(() => getTodayMenu(getIstNow(), dietPreference), [dietPreference]);
  const today = getIstDateString();
  const fallbackMealCards = useMemo(
    () => [todayMenu.meals.breakfast, todayMenu.meals.lunch, todayMenu.meals.snack, todayMenu.meals.dinner],
    [todayMenu],
  );

  const [mealCards, setMealCards] = useState(fallbackMealCards);

  const [mealStatuses, setMealStatuses] = useState<Record<string, OptInStatus>>({
    'meal-breakfast': null,
    'meal-lunch': null,
    'meal-snack': null,
    'meal-dinner': null,
  });
  const [portions, setPortions] = useState<Record<string, PortionSize>>({
    'meal-breakfast': 'full',
    'meal-lunch': 'full',
    'meal-snack': 'full',
    'meal-dinner': 'full',
  });
  const [optinCounts, setOptinCounts] = useState<Record<string, number>>({
    'meal-breakfast': todayMenu.meals.breakfast.attendees,
    'meal-lunch': todayMenu.meals.lunch.attendees,
    'meal-snack': todayMenu.meals.snack.attendees,
    'meal-dinner': todayMenu.meals.dinner.attendees,
  });
  const [loadingMeal, setLoadingMeal] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadMenuCards = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/live/final-menu?date=${today}&pref=${dietPreference}`, { signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || signal?.aborted) {
        console.log('Load generated today menu error:', payload?.message || 'request failed');
        return;
      }

      if (payload?.menu) {
        cacheGeneratedMenuDay(payload.menu);
      }

      const rows = Array.isArray(payload?.menu?.meals)
        ? payload.menu.meals
        : Array.isArray(payload?.rows)
          ? payload.rows
          : [];

      if (rows.length === 0) {
        setMealCards(fallbackMealCards);
        return;
      }

      const itemsByMealType: Record<string, { items: string[], votes?: number }> = {};
      rows.forEach((row: any) => {
        const mealType = String(row.mealType ?? row.meal_type ?? '');
        const fixedItems = Array.isArray(row.fixedItems) ? row.fixedItems.map((item: unknown) => String(item)) : [];
        const winningItems = Array.isArray(row.winningItems)
          ? row.winningItems.flatMap((item: any) => Array.isArray(item.items) ? item.items.map((value: unknown) => String(value)) : [])
          : [];
        
        let totalVotes = 0;
        if (Array.isArray(row.winningItems)) {
          totalVotes = row.winningItems.reduce((sum: number, item: any) => sum + (Number(item.votes) || 0), 0);
        }

        if (mealType) {
          itemsByMealType[mealType] = {
            items: Array.from(new Set([...fixedItems, ...winningItems])),
            votes: totalVotes
          };
        }
      });

      setMealCards(fallbackMealCards.map((meal) => {
        const items = itemsByMealType[meal.mealType]?.items ?? meal.items;
        // Strict filter for veg users
        const filteredItems = dietPreference === 'veg' 
          ? items.filter(i => {
              const lower = i.toLowerCase();
              return !lower.includes('chicken') && !lower.includes('egg') && !lower.includes('mutton') && !lower.includes('fish');
            })
          : items;

        return {
          ...meal,
          items: filteredItems,
          votes: itemsByMealType[meal.mealType]?.votes,
        };
      }));
    } catch (error: any) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.log('Load generated today menu error:', error.message);
      setMealCards(fallbackMealCards);
    }
  }, [fallbackMealCards, today, dietPreference]);

  const loadOptins = useCallback(async (signal?: AbortSignal) => {
    if (!user?.id) {
      setMealStatuses({
        'meal-breakfast': null,
        'meal-lunch': null,
        'meal-snack': null,
        'meal-dinner': null,
      });
      return;
    }

    try {
      const response = await fetch(`/api/meal-optins?date=${today}&studentId=${user.id}`, { signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || signal?.aborted) {
        console.log('Load optins error:', payload?.message || 'request failed');
        return;
      }

      const statusMap: Record<string, OptInStatus> = {
        'meal-breakfast': null,
        'meal-lunch': null,
        'meal-snack': null,
        'meal-dinner': null,
      };
      const portionMap: Record<string, PortionSize> = {
        'meal-breakfast': 'full',
        'meal-lunch': 'full',
        'meal-snack': 'full',
        'meal-dinner': 'full',
      };

      (payload?.rows ?? []).forEach((row: any) => {
        const mealType = row.meal_name ?? row.meal_type;
        const key = `meal-${mealType}`;
        const status = row.status as string;
        statusMap[key] =
          status === 'skip' || status === 'skipping'
            ? 'skip'
            : status === 'takeaway'
              ? 'takeaway'
              : status === 'attending'
                ? 'attending'
                : null;
        portionMap[key] = 'full';
      });

      setMealStatuses(statusMap);
      setPortions(portionMap);
    } catch (error: any) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.log('Load optins error:', error.message);
    }
  }, [today, user?.id]);

  const loadOptinCounts = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/meal-optins?date=${today}`, { signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || signal?.aborted) {
        console.log('Load counts error:', payload?.message || 'request failed');
        return;
      }

      const counts: Record<string, number> = {
        'meal-breakfast': todayMenu.meals.breakfast.attendees,
        'meal-lunch': todayMenu.meals.lunch.attendees,
        'meal-snack': todayMenu.meals.snack.attendees,
        'meal-dinner': todayMenu.meals.dinner.attendees,
      };

      (payload?.rows ?? []).forEach((row: any) => {
        const key = `meal-${row.meal_type}`;
        if (counts[key] !== undefined) {
          counts[key] = Number(row.confirmed || 0);
        }
      });

      setOptinCounts(counts);
    } catch (error: any) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.log('Load counts error:', error.message);
    }
  }, [
    today,
    todayMenu.meals.breakfast.attendees,
    todayMenu.meals.lunch.attendees,
    todayMenu.meals.snack.attendees,
    todayMenu.meals.dinner.attendees,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const refreshData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          loadMenuCards(signal),
          loadOptins(signal),
          loadOptinCounts(signal)
        ]);
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void refreshData();

    const id = window.setInterval(() => {
      void refreshData();
    }, 60000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshData();
      }
    };

    window.addEventListener('focus', refreshData);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      controller.abort();
      window.clearInterval(id);
      window.removeEventListener('focus', refreshData);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadMenuCards, loadOptins, loadOptinCounts]);

  const handleOptIn = async (mealId: string, status: Exclude<OptInStatus, null>) => {
    if (!user || !status) return;
    const meal = mealCards.find((entry) => entry.id === mealId);
    if (!meal) return;

    setLoadingMeal(mealId);
    try {
      const response = await fetch('/api/meal-optins', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: user.id,
          mealDate: today,
          mealType: meal.mealType,
          status,
          portionSize: portions[mealId] || 'full',
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        console.log('Opt-in error:', response.status, payload?.message || 'request failed');
        toast.error(payload?.message ? `Failed: ${payload.message}` : 'Failed to save your choice. Please try again.');
        return;
      }

      setMealStatuses((prev) => ({ ...prev, [mealId]: status }));
      const labels: Record<Exclude<OptInStatus, null>, string> = {
        attending: "You're confirmed for this meal! 🎉",
        skip: "Meal skipped. We'll adjust the count.",
        takeaway: 'Takeaway reserved! Collect from counter.',
      };
      toast.success(labels[status]);
    } catch (error: any) {
      console.log('Opt-in error:', error.message);
      toast.error('Failed to save your choice.');
    } finally {
      setLoadingMeal(null);
    }
  };

  const handlePortion = async (mealId: string, size: PortionSize) => {
    setPortions((prev) => ({ ...prev, [mealId]: size }));
    toast.info(`Portion updated to ${size}`);

    if (!user || !mealStatuses[mealId]) return;
    const meal = mealCards.find((entry) => entry.id === mealId);
    if (!meal) return;

    try {
      await fetch('/api/meal-optins', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: user.id,
          mealDate: today,
          mealType: meal.mealType,
          status: mealStatuses[mealId],
          portionSize: size,
        }),
      });
    } catch (error: any) {
      console.log('Portion update error:', error.message);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-base sm:text-lg font-semibold" style={{ color: 'var(--student-text)' }}>Today&apos;s Meals</h2>
        <span className="text-xs sm:text-sm" style={{ color: 'var(--student-muted)' }}>IST {getIstTimeLabel()}</span>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {isLoading && (
          <div className="sr-only">Loading today&apos;s opt-ins...</div>
        )}
        {mealCards.map((meal) => {
          const state = getMealStatus(meal.mealType) as MealWindowStatus;
          const status = mealStatuses[meal.id];
          const portion = portions[meal.id];
          const attendees = optinCounts[meal.id] ?? meal.attendees;
          const fillPct = Math.round((attendees / meal.capacity) * 100);
          const isThisMealLoading = loadingMeal === meal.id;
          const canRespond = state === 'open';
          const locked = state !== 'open';

          return (
            <div
              key={meal.id}
              className={`student-glass-card p-4 sm:p-5 transition-all duration-300 hover:-translate-y-0.5 ${
                state === 'past' ? 'opacity-60' : ''
              } ${status === 'attending' ? 'border border-green-500/30' : ''} ${status === 'skip' ? 'border border-red-500/20' : ''}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
                <div className="flex items-start gap-2.5">
                  <span className="text-2xl">{meal.emoji}</span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base sm:text-[17px] font-bold" style={{ color: 'var(--student-text)' }}>
                        {meal.label}
                      </h3>
                      {meal.special && <span className="text-xs font-medium text-yellow-300">{meal.special}</span>}
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                          state === 'past'
                            ? 'bg-white/10 text-white/60'
                            : state === 'open'
                              ? 'bg-green-500/16 text-green-300 shadow-[0_0_14px_rgba(34,197,94,0.28)]'
                              : 'bg-amber-500/14 text-amber-200'
                        }`}
                      >
                        {state === 'open' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-slow" />}
                        {formatMealStatusLabel(state)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                      <Clock size={11} />
                      <span>{meal.time}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-cyan-200/80 mt-0.5">
                      <Clock size={10} />
                      <span>IST now {getIstTimeLabel()}</span>
                    </div>
                  </div>
                </div>
                {status === 'attending' && <CheckCircle2 size={20} className="text-green-400 flex-shrink-0" />}
                {status === 'skip' && <XCircle size={20} className="text-red-400 flex-shrink-0" />}
                {status === 'takeaway' && <Package size={20} className="text-cyan-400 flex-shrink-0" />}
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {meal.items.filter(item => {
                  if (dietPreference !== 'veg') return true;
                  const lower = item.toLowerCase();
                  return !lower.includes('chicken') && !lower.includes('egg') && !lower.includes('mutton') && !lower.includes('fish');
                }).map((item) => (
                  <span key={`${meal.id}-${item}`} className="text-xs px-2 py-1 rounded-lg bg-white/6 text-white/75 border border-white/8">
                    {item}
                  </span>
                ))}
                {(meal as any).votes > 0 && (
                  <span className="text-[10px] px-2.5 py-1 rounded-lg bg-indigo-500/30 text-indigo-200 border border-indigo-500/50 flex items-center gap-1.5 font-black shadow-[0_0_12px_rgba(99,102,241,0.25)] animate-in fade-in zoom-in-95 duration-500">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    🏆 WINNING MENU · {(meal as any).votes} VOTES
                  </span>
                )}
              </div>

                {attendees > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                        <Users size={11} />
                        <span>{attendees} attending</span>
                      </div>
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">{fillPct}% capacity</span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${fillPct}%`,
                          background: fillPct > 85 ? '#ef4444' : fillPct > 60 ? '#f59e0b' : '#22c55e',
                        }}
                      />
                    </div>
                  </div>
                )}

                {status === 'attending' && state !== 'past' && canRespond && (
                  <div className="mb-3">
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">Portion size</p>
                    <div className="flex gap-2">
                      {(['half', 'full', 'extra'] as PortionSize[]).map((size) => (
                        <button
                          key={`${meal.id}-portion-${size}`}
                          onClick={() => handlePortion(meal.id, size)}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                            portion === size ? 'bg-indigo-500/25 border-indigo-500/50 text-indigo-300' : 'bg-white/4 border-white/8 text-white/50 hover:bg-white/8'
                          }`}
                        >
                          {size === 'half' ? '½ Half' : size === 'full' ? '◉ Full' : '+ Extra'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {state !== 'past' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      onClick={() => handleOptIn(meal.id, 'attending')}
                      disabled={isThisMealLoading || locked}
                      className={`py-2.5 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all active:scale-95 disabled:opacity-60 ${
                        status === 'attending'
                          ? 'bg-green-500/20 border-green-500/40 text-green-400'
                          : locked
                            ? 'bg-white/3 border-white/8 text-white/45'
                            : 'bg-white/4 border-white/8 text-white/60 hover:bg-green-500/10 hover:border-green-500/25'
                      }`}
                    >
                      <span className="text-sm">{locked ? <Lock size={12} /> : isThisMealLoading ? '⏳' : '✅'}</span>
                      <span>Will Eat</span>
                    </button>
                    <button
                      onClick={() => handleOptIn(meal.id, 'skip')}
                      disabled={isThisMealLoading || locked}
                      className={`py-2.5 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all active:scale-95 disabled:opacity-60 ${
                        status === 'skip'
                          ? 'bg-red-500/20 border-red-500/40 text-red-400'
                          : locked
                            ? 'bg-white/3 border-white/8 text-white/45'
                            : 'bg-white/4 border-white/8 text-white/60 hover:bg-red-500/10 hover:border-red-500/25'
                      }`}
                    >
                      <span className="text-sm">{locked ? <Lock size={12} /> : '❌'}</span>
                      <span>Skip</span>
                    </button>
                    <button
                      onClick={() => handleOptIn(meal.id, 'takeaway')}
                      disabled={isThisMealLoading || locked}
                      className={`py-2.5 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all active:scale-95 disabled:opacity-60 ${
                        status === 'takeaway'
                          ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                          : locked
                            ? 'bg-white/3 border-white/8 text-white/45'
                            : 'bg-white/4 border-white/8 text-white/60 hover:bg-cyan-500/10 hover:border-cyan-500/25'
                      }`}
                    >
                      <span className="text-sm">{locked ? <Lock size={12} /> : '📦'}</span>
                      <span>Takeaway</span>
                    </button>
                  </div>
                )}

                {state === 'past' && (
                  <div className="text-center py-2">
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      {status === 'attending' ? '✅ You attended this meal' : status === 'skip' ? '⏭️ You skipped this meal' : '📝 No opt-in recorded'}
                    </span>
                  </div>
                )}

                {!state.startsWith('past') && canRespond && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-amber-400/80">
                    <Clock size={10} />
                    <span>{meal.deadline}</span>
                  </div>
                )}
                {!canRespond && state !== 'past' && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-rose-300/80">
                    <Clock size={10} />
                    <span>Opt-ins closed at {meal.deadline.replace('Opt-in by ', '')}</span>
                  </div>
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
}