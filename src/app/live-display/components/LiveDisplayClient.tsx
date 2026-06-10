'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, Clock, AlertTriangle, Star, TrendingUp, Zap } from 'lucide-react';
import { getIstDateString, getMealTiming } from '@/lib/utils/mealStatus';
import { getSnackForDate } from '@/lib/snackSchedule';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Dish {
  name: string;
  emoji: string;
  totalPortions: number;
  remaining: number;
  rating: number;
  ratingCount: number;
  isPopular?: boolean;
  isSurplus?: boolean;
}

interface Meal {
  id: string;
  type: string;
  emoji: string;
  time: string;
  status: 'past' | 'active' | 'upcoming';
  optIns: number;
  capacity: number;
  dishes: Dish[];
}

interface VoteOption {
  menuOption: string;
  dish: string;
  emoji: string;
  votes: number;
  total: number;
}

interface SurplusAlert {
  id: string;
  meal: string;
  dish: string;
  emoji: string;
  surplus: number;
  message: string;
}

function getUiMealStatus(mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner') {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const timing = getMealTiming(mealType);
  if (minutes < timing.startMinutes) return 'upcoming' as const;
  if (minutes <= timing.endMinutes) return 'active' as const;
  return 'past' as const;
}

// ─── Helper: Star Rating ──────────────────────────────────────────────────────
function StarRating({ rating, count }: { rating: number; count: number }) {
  if (rating === 0) return <span className="text-xs text-white/30 font-mono">No ratings yet</span>;
  return (
    <div className="flex items-center gap-1">
      <Star size={11} className="text-amber-400 fill-amber-400" />
      <span className="text-xs font-bold font-mono text-amber-400">{rating.toFixed(1)}</span>
      <span className="text-xs text-white/40">({count})</span>
    </div>
  );
}

// ─── Helper: Portion Bar ──────────────────────────────────────────────────────
function PortionBar({ remaining, total }: { remaining: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((remaining / total) * 100);
  const color = pct > 50 ? '#22c55e' : pct > 20 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono font-bold" style={{ color }}>
        {remaining}/{total}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LiveDisplayClient() {
  const today = getIstDateString();
  const tomorrow = getIstDateString(1);

  const [meals, setMeals] = useState<Meal[]>([]);
  const [alerts, setAlerts] = useState<SurplusAlert[]>([]);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [alertIndex, setAlertIndex] = useState(0);
  const [tick, setTick] = useState(0);
  const [tomorrowVotes, setTomorrowVotes] = useState<{ category: string; emoji: string; options: VoteOption[] }[]>([]);
  const [mealRatings, setMealRatings] = useState<Record<string, { avgRating: number; totalRatings: number }>>({});
  const [totalVoteCount, setTotalVoteCount] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load all live data in a single synchronized flow
  const normalizeDishName = (name: string) => {
    return String(name || '').trim()
      .replace(/\s*\+\s*/g, ' + ')
      .replace(/\s+/g, ' ')
      .replace(/\bchappathi\b/gi, 'Chapati')
      .replace(/\bchapathi\b/gi, 'Chapati')
      .replace(/\bidly\b/gi, 'Idli')
      .replace(/\bdosai\b/gi, 'Dosa')
      .replace(/\bpoha\b/gi, 'Poha')
      .replace(/\bpongal\b/gi, 'Pongal')
      .replace(/\bpappu\b/gi, 'Pappu')
      .split(' ')
      .map((word) => (word === '+' ? '+' : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`))
      .join(' ');
  };

  const loadAllData = useCallback(async () => {
    try {
      const [menuRes, optinsRes, votesRes, optionsRes, ratingsRes, mealTypeRatingsRes] = await Promise.all([
        fetch(`/api/live/final-menu?date=${today}`),
        fetch(`/api/live/optins?date=${today}`),
        fetch(`/api/meal-votes?date=${tomorrow}`),
        fetch(`/api/vote-options?date=${tomorrow}`),
        fetch(`/api/meal-ratings?aggregate=dish&date=${today}`),
        fetch(`/api/meal-ratings?aggregate=meal-type&date=${today}`)
      ]);

      const [menuPayload, optinsPayload, votesPayload, optionsPayload, ratingsPayload, mealTypeRatingsPayload] = await Promise.all([
        menuRes.json().catch(() => ({})),
        optinsRes.json().catch(() => ({})),
        votesRes.json().catch(() => ({})),
        optionsRes.json().catch(() => ({})),
        ratingsRes.json().catch(() => ({ ratings: [] })),
        mealTypeRatingsRes.json().catch(() => ({ mealTypeRatings: [] }))
      ]);

      const studentsCount = Number(menuPayload?.totalStudents || 7);
      setTotalStudents(studentsCount);

      const mealTypeRatingsRows = Array.isArray(mealTypeRatingsPayload?.mealTypeRatings)
        ? mealTypeRatingsPayload.mealTypeRatings
        : [];
      const mealRatingsByType: Record<string, { avgRating: number; totalRatings: number }> = {};
      mealTypeRatingsRows.forEach((row: any) => {
        if (row.mealType) {
          mealRatingsByType[String(row.mealType)] = {
            avgRating: Number(row.avgRating || row.avg_rating || 0),
            totalRatings: Number(row.totalRatings || row.total_ratings || 0),
          };
        }
      });
      setMealRatings(mealRatingsByType);

      // 1. Process Menu & Opt-ins
      const menuRows = Array.isArray(menuPayload?.rows) ? menuPayload.rows : [];
      const optinCounts = optinsPayload?.counts ?? { breakfast: 0, lunch: 0, snack: 0, dinner: 0 };
      const ratingMap: Record<string, { rating: number; votes: number }> = {};
      const ratingRows = Array.isArray(ratingsPayload?.ratings) ? ratingsPayload.ratings : [];

      ratingRows.forEach((row: any) => {
        const dishName = normalizeDishName(String(row.dishName || row.dish_name || ''));
        if (!dishName) return;
        ratingMap[dishName] = {
          rating: Number(row.avgRating || row.avg_rating || 0),
          votes: Number(row.votes || row.rating_count || 0),
        };
      });

      const builtMeals: Meal[] = menuRows.map((m: any) => {
        const confirmed = optinCounts[m.mealType] || 0;
        return {
          id: m.mealType,
          type: m.mealType.charAt(0).toUpperCase() + m.mealType.slice(1),
          emoji: m.mealType === 'breakfast' ? '🌅' : m.mealType === 'lunch' ? '☀️' : m.mealType === 'snack' ? '🍪' : '🌙',
          time: getMealTiming(m.mealType).displayWindow,
          status: getUiMealStatus(m.mealType),
          optIns: confirmed,
          capacity: studentsCount,
          dishes: [
            ...(m.winningItems || []).flatMap((wi: any) => (wi.items || [wi.label]).map((d: string) => {
              const normalized = normalizeDishName(d);
              const ratingData = ratingMap[normalized] || { rating: 0, votes: 0 };
              return {
                name: d,
                emoji: wi.emoji || '🍽️',
                totalPortions: confirmed,
                remaining: Math.max(0, confirmed - Math.floor(confirmed * 0.1)), // Mock consumption
                rating: ratingData.rating,
                ratingCount: ratingData.votes,
                isPopular: true
              };
            })),
            ...(m.fixedItems || []).map((d: string) => {
              const normalized = normalizeDishName(d);
              const ratingData = ratingMap[normalized] || { rating: 0, votes: 0 };
              return {
                name: d,
                emoji: '🍲',
                totalPortions: confirmed,
                remaining: Math.max(0, confirmed - Math.floor(confirmed * 0.1)),
                rating: ratingData.rating,
                ratingCount: ratingData.votes
              };
            })
          ]
        };
      });
      setMeals(builtMeals);

      // 2. Process Tomorrow's Votes
      const voteRows = Array.isArray(votesPayload?.rows) ? votesPayload.rows : [];
      const voteOptions = Array.isArray(optionsPayload?.options) ? optionsPayload.options : [];
      
      const counts: Record<string, number> = {};
      const mealTotals: Record<string, number> = {};
      voteRows.forEach((row: any) => {
        const key = String(row.menuOption ?? row.dish_option_id ?? '');
        const votes = Number(row.votes ?? row.total_votes ?? 0);
        counts[key] = votes;
        const mt = row.mealType || row.meal_type;
        if (mt) mealTotals[mt] = (mealTotals[mt] || 0) + votes;
      });

      setTotalVoteCount(voteRows.reduce((sum: number, row: any) => sum + Number(row.votes ?? row.total_votes ?? 0), 0));

      const categories: Record<string, VoteOption[]> = {};
      voteOptions.forEach((opt: any) => {
        const catName = `Tomorrow's ${opt.mealType.charAt(0).toUpperCase() + opt.mealType.slice(1)}`;
        if (!categories[catName]) categories[catName] = [];
        const total = mealTotals[opt.mealType] || 0;
        categories[catName].push({
          menuOption: opt.id,
          dish: opt.label,
          emoji: opt.emoji,
          votes: counts[opt.id] || 0,
          total: Math.max(total, 1)
        });
      });

      setTomorrowVotes(Object.entries(categories).map(([name, opts]) => ({
        category: name,
        emoji: name.toLowerCase().includes('breakfast') ? '🌅' : '☀️',
        options: opts
      })));

      setLoading(false);
    } catch (err) {
      console.log('Load live board data error:', err);
      setLoading(false);
    }
  }, [today, tomorrow]);

  useEffect(() => {
    loadAllData();
    const id = setInterval(loadAllData, 30000); // Faster polling for Live Board
    return () => clearInterval(id);
  }, [loadAllData]);

  // Clock
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
      setCurrentDate(now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  // Keep meal status aligned with live IST time so the board doesn't show stale "active" badges.
  useEffect(() => {
    const syncMealStatus = () => {
      setMeals(prev => prev.map(meal => ({
        ...meal,
        status: getUiMealStatus(meal.id as 'breakfast' | 'lunch' | 'snack' | 'dinner'),
      })));
    };

    syncMealStatus();
    const id = window.setInterval(syncMealStatus, 30000);
    return () => window.clearInterval(id);
  }, []);

  // Simulate live portion countdown for active meal
  useEffect(() => {
    const id = setInterval(() => {
      setMeals(prev =>
        prev.map(meal =>
          getUiMealStatus(meal.id as 'breakfast' | 'lunch' | 'snack' | 'dinner') === 'active'
            ? {
                ...meal,
                dishes: meal.dishes.map(d =>
                  d.remaining > 0 ? { ...d, remaining: Math.max(0, d.remaining - 1) } : d
                ),
              }
            : meal
        )
      );
      setTick(t => t + 1);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  // Rotate surplus alert banner
  useEffect(() => {
    if (alerts.length <= 1) return;
    const id = setInterval(() => setAlertIndex(i => (i + 1) % alerts.length), 5000);
    return () => clearInterval(id);
  }, [alerts.length]);

  const displayMeals = meals.map(meal => ({
    ...meal,
    status: getUiMealStatus(meal.id as 'breakfast' | 'lunch' | 'snack' | 'dinner'),
  }));
  const activeMeal = displayMeals.find(m => m.status === 'active');
  const currentAlert = alerts[alertIndex];

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden"
      style={{
        background: 'radial-gradient(ellipse at 20% 10%, rgba(99,102,241,0.18) 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(6,182,212,0.12) 0%, transparent 55%), hsl(222,47%,6%)',
      }}
    >
      {/* ── Top Header Bar ── */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg">
            <span className="text-2xl">🍽️</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">MessMate Live Board</h1>
            <p className="text-sm text-white/50">Hostel A Mess · Real-time Display</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Live indicator */}
          <div className="flex items-center gap-2 bg-green-500/12 border border-green-500/25 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse-slow" />
            <Wifi size={13} className="text-green-400" />
            <span className="text-sm font-semibold text-green-400">LIVE</span>
          </div>

          {/* Clock */}
          <div className="text-right">
            <div className="text-2xl font-bold font-mono text-white tracking-widest">{currentTime}</div>
            <div className="text-xs text-white/50">{currentDate}</div>
          </div>
        </div>
      </header>

      {/* ── Surplus Alert Banner ── */}
      {alerts.length > 0 && (
        <div className="mx-6 mt-4 px-5 py-3 rounded-2xl flex items-center gap-3 border border-amber-500/30 bg-amber-500/10 animate-pulse-slow">
          <AlertTriangle size={18} className="text-amber-400 flex-shrink-0" />
          <span className="text-sm font-bold text-amber-300 mr-1">SURPLUS ALERT:</span>
          <span className="text-sm text-amber-200/90 flex-1">
            {currentAlert.emoji} <strong>{currentAlert.dish}</strong> ({currentAlert.meal}) — {currentAlert.message}
          </span>
          <span className="text-xs text-amber-400/60 font-mono">{alertIndex + 1}/{alerts.length}</span>
        </div>
      )}

      {/* ── Main Grid ── */}
      <main className="px-6 py-5 grid grid-cols-12 gap-5">

        {/* ── LEFT: Today's Full Menu (spans 8 cols) ── */}
        <section className="col-span-12 xl:col-span-8 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">📋</span>
            <h2 className="text-lg font-bold text-white">Today&apos;s Menu</h2>
            <span className="text-xs text-white/40 ml-auto">Portions update in real-time</span>
          </div>

          {displayMeals.map(meal => {
            const fillPct = Math.round((meal.optIns / meal.capacity) * 100);
            const statusColors: Record<string, string> = {
              past: 'text-white/30',
              active: 'text-green-400',
              upcoming: 'text-cyan-400',
            };
            const statusLabels: Record<string, string> = {
              past: 'Completed',
              active: 'Serving Now',
              upcoming: 'Upcoming',
            };

            return (
              <div
                key={meal.id}
                className={`glass-card p-5 transition-all duration-500 ${
                  meal.status === 'active' ? 'border border-green-500/25 shadow-[0_0_30px_rgba(34,197,94,0.08)]'
                    : meal.status === 'past' ? 'opacity-55' : ''
                }`}
              >
                {/* Meal header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{meal.emoji}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-white">{meal.type}</h3>
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                          meal.status === 'active' ? 'bg-green-500/15 border-green-500/30 text-green-400'
                            : meal.status === 'past' ? 'bg-white/6 border-white/10 text-white/40' :'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
                        }`}>
                          {meal.status === 'active' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-slow mr-1" />}
                          {statusLabels[meal.status]}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock size={12} className="text-white/40" />
                        <span className="text-sm text-white/50">{meal.time}</span>
                      </div>
                    </div>
                  </div>

                  {/* Opt-in count */}
                  <div className="text-right">
                    <div className="text-3xl font-bold font-mono text-white">{meal.optIns}</div>
                    <div className="text-xs text-white/40">of {meal.capacity} opted in</div>
                    <div className="mt-1 w-24 progress-bar ml-auto">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${fillPct}%`,
                          background: fillPct > 85 ? '#ef4444' : fillPct > 60 ? '#f59e0b' : '#22c55e',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Dish grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {meal.dishes.map(dish => {
                    const portionPct = dish.totalPortions === 0 ? 0 : Math.round((dish.remaining / dish.totalPortions) * 100);
                    return (
                      <div
                        key={dish.name}
                        className={`p-3 rounded-xl border transition-all ${
                          dish.isSurplus
                            ? 'bg-amber-500/8 border-amber-500/25'
                            : dish.isPopular
                            ? 'bg-indigo-500/8 border-indigo-500/20' : 'bg-white/3 border-white/8'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xl">{dish.emoji}</span>
                            <span className="text-sm font-semibold text-white leading-tight">{dish.name}</span>
                          </div>
                          {dish.isPopular && <span className="text-xs text-indigo-400 font-bold">🔥</span>}
                          {dish.isSurplus && <span className="text-xs text-amber-400 font-bold">⚡</span>}
                        </div>

                        <StarRating rating={dish.rating} count={dish.ratingCount} />

                        {meal.status !== 'upcoming' && (
                          <PortionBar remaining={dish.remaining} total={dish.totalPortions} />
                        )}

                        {meal.status === 'upcoming' && (
                          <div className="mt-1 text-xs text-white/30 font-mono">{dish.totalPortions} portions planned</div>
                        )}

                        {dish.isSurplus && meal.status === 'active' && (
                          <div className="mt-1.5 text-xs text-amber-400 font-semibold">
                            Surplus — Claim at counter!
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>

        {/* ── RIGHT: Sidebar (spans 4 cols) ── */}
        <aside className="col-span-12 xl:col-span-4 space-y-4">

          {/* Live Vote Counts */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Tomorrow&apos;s Menu — voted by students</h3>
                <p className="text-xs text-white/40">Live community preference</p>
              </div>
              <div className="flex items-center gap-1.5 bg-indigo-500/12 border border-indigo-500/25 px-2.5 py-1 rounded-full">
                <TrendingUp size={12} className="text-indigo-400" />
                <span className="text-xs font-bold text-indigo-400">{totalVoteCount} votes</span>
              </div>
            </div>

            {tomorrowVotes.map(category => (
              <div key={category.category} className="mb-4 last:mb-0">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                  {category.emoji} {category.category}
                </p>
                <div className="space-y-2">
                  {category.options
                    .slice()
                    .sort((a, b) => b.votes - a.votes)
                    .map((opt, idx) => {
                      const pct = Math.round((opt.votes / (opt.total || 1)) * 100);
                      const isLeading = idx === 0;
                      return (
                        <div key={opt.dish} className={`p-2.5 rounded-xl border ${isLeading ? 'bg-indigo-500/10 border-indigo-500/25' : 'bg-white/3 border-white/8'}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-base">{opt.emoji}</span>
                              <span className={`text-xs font-medium ${isLeading ? 'text-white' : 'text-white/70'}`}>{opt.dish}</span>
                              {isLeading && <span className="text-xs text-indigo-400 font-bold">👑</span>}
                            </div>
                            <span className="text-xs font-bold font-mono text-white/70">{pct}%</span>
                          </div>
                          <div className="progress-bar">
                            <div
                              className="progress-fill"
                              style={{
                                width: `${pct}%`,
                                background: isLeading ? '#818cf8' : 'rgba(255,255,255,0.15)',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>

          {/* Surplus Food Alerts Panel */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={16} className="text-amber-400" />
              <h3 className="text-base font-bold text-white">Surplus Food</h3>
              <span className="ml-auto text-xs bg-amber-500/15 border border-amber-500/25 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                {alerts.length} items
              </span>
            </div>

            <div className="space-y-3">
              {alerts.map(alert => (
                <div key={alert.id} className="p-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{alert.emoji}</span>
                    <div>
                      <div className="text-sm font-bold text-white">{alert.dish}</div>
                      <div className="text-xs text-white/50">{alert.meal}</div>
                    </div>
                    <div className="ml-auto text-right">
                      <div className="text-2xl font-bold font-mono text-amber-400">{alert.surplus}</div>
                      <div className="text-xs text-white/40">portions left</div>
                    </div>
                  </div>
                  <p className="text-xs text-amber-300/80 mt-1">{alert.message}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 p-3 rounded-xl bg-green-500/8 border border-green-500/20">
              <p className="text-xs text-green-400 font-semibold mb-0.5">♻️ Zero Waste Initiative</p>
              <p className="text-xs text-white/50">Surplus food is available free of charge. Help us reduce waste!</p>
            </div>
          </div>

          {/* Today's Ratings Summary */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Star size={16} className="text-amber-400 fill-amber-400" />
              <h3 className="text-base font-bold text-white">Today&apos;s Ratings</h3>
            </div>

            <div className="space-y-3">
              {displayMeals
                .filter(m => m.status !== 'upcoming')
                .map(meal => {
                  const mealRating = mealRatings[meal.id];
                  const ratedDishes = meal.dishes.filter(d => d.ratingCount > 0);
                  const computedAvgRating =
                    ratedDishes.length > 0
                      ? ratedDishes.reduce((sum, d) => sum + d.rating, 0) / ratedDishes.length
                      : 0;
                  const computedTotalRatings = ratedDishes.reduce((sum, d) => sum + d.ratingCount, 0);
                  const avgRating = mealRating?.avgRating ?? computedAvgRating;
                  const totalRatings = mealRating?.totalRatings ?? computedTotalRatings;

                  return (
                    <div key={meal.id} className="flex items-center justify-between p-3 rounded-xl bg-white/3 border border-white/8">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{meal.emoji}</span>
                        <div>
                          <div className="text-sm font-semibold text-white">{meal.type}</div>
                          <div className="text-xs text-white/40">{totalRatings} ratings</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Star size={14} className="text-amber-400 fill-amber-400" />
                        <span className="text-lg font-bold font-mono text-amber-400">
                          {avgRating > 0 ? avgRating.toFixed(1) : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Top rated dish */}
            {activeMeal && (
              <div className="mt-3 p-3 rounded-xl bg-indigo-500/8 border border-indigo-500/20">
                <p className="text-xs text-indigo-400 font-semibold mb-1">⭐ Top Rated Today</p>
                {(() => {
                  const allRated = meals
                    .flatMap(m => m.dishes.filter(d => d.ratingCount > 0))
                    .sort((a, b) => b.rating - a.rating)[0];
                  return allRated ? (
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{allRated.emoji}</span>
                      <span className="text-sm font-bold text-white">{allRated.name}</span>
                      <div className="ml-auto flex items-center gap-1">
                        <Star size={12} className="text-amber-400 fill-amber-400" />
                        <span className="text-sm font-bold font-mono text-amber-400">{allRated.rating.toFixed(1)}</span>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>

        </aside>
      </main>

      {/* ── Footer ticker ── */}
      <footer className="mt-2 px-6 py-3 border-t border-white/6 flex items-center justify-between">
        <span className="text-xs text-white/30">MessMate · Hostel A Mess</span>
        <span className="text-xs text-white/30 font-mono">
          Last updated: {currentTime}
        </span>
      </footer>
    </div>
  );
}
