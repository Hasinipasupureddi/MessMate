'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend } from 'recharts';

interface RatingsChartProps {
  expanded?: boolean;
}

type DishRating = {
  id: string;
  dish: string;
  rating: number;
  votes: number;
  emoji: string;
};

type RatingTrendRow = {
  date: string;
  avgRating: number;
  totalRatings: number;
};

type MealTypeRating = {
  mealType: string;
  avgRating: number;
  totalRatings: number;
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-3 text-xs shadow-2xl border border-white/15">
        <p className="text-white font-semibold mb-1">{label}</p>
        {payload.map((entry, i) => (
          <p key={`tooltip-entry-${i}`} style={{ color: entry.color }} className="font-mono">
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function RatingsChart({ expanded = false }: RatingsChartProps) {
  const [ratings, setRatings] = useState<DishRating[]>([]);
  const [trendData, setTrendData] = useState<RatingTrendRow[]>([]);
  const [mealTypeData, setMealTypeData] = useState<MealTypeRating[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRatings = useCallback(async () => {
    try {
      const response = await fetch('/api/meal-ratings?aggregate=dish');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setLoading(false);
        return;
      }

      const rows: DishRating[] = (payload?.ratings ?? []).map((r: any, idx: number) => ({
        id: `dish-${idx}`,
        dish: String(r.dish_name || r.dishName || 'Unknown'),
        rating: Number(r.avg_rating || r.avgRating || 0),
        votes: Number(r.total_ratings || r.totalRatings || r.votes || 0),
        emoji: r.emoji || '🍽️',
      }));

      setRatings(rows);
    } catch {
      // non-blocking
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTrendData = useCallback(async () => {
    try {
      const [trendRes, mealTypeRes] = await Promise.all([
        fetch('/api/meal-ratings?aggregate=trend'),
        fetch('/api/meal-ratings?aggregate=meal-type'),
      ]);
      const trendPayload = await trendRes.json().catch(() => ({}));
      const mealTypePayload = await mealTypeRes.json().catch(() => ({}));

      const trendRows = Array.isArray(trendPayload?.trend) ? trendPayload.trend : [];
      const mealTypeRows = Array.isArray(mealTypePayload?.mealTypeRatings) ? mealTypePayload.mealTypeRatings : [];

      setTrendData(trendRows.map((row: any) => ({
        date: String(row.date || row.rating_date || ''),
        avgRating: Number(row.avgRating || row.avg_rating || 0),
        totalRatings: Number(row.totalRatings || row.total_ratings || 0),
      })));

      setMealTypeData(mealTypeRows.map((row: any) => ({
        mealType: String(row.mealType || row.meal_type || ''),
        avgRating: Number(row.avgRating || row.avg_rating || 0),
        totalRatings: Number(row.totalRatings || row.total_ratings || 0),
      })));
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    void loadRatings();
  }, [loadRatings]);

  useEffect(() => {
    if (expanded) {
      void loadTrendData();
    }
  }, [expanded, loadTrendData]);

  const hasData = ratings.length > 0;

  // Derive highlights from live data
  const bestRated = hasData ? [...ratings].sort((a, b) => b.rating - a.rating)[0] : null;
  const mostVoted = hasData ? [...ratings].sort((a, b) => b.votes - a.votes)[0] : null;
  const needsWork = hasData ? [...ratings].sort((a, b) => a.rating - b.rating)[0] : null;

  const shortenDishName = (name: string) => {
    if (name.includes('+')) {
      return name.split('+')[0].trim() + ' Combo';
    }
    return name;
  };

  const displayedRatings = expanded ? ratings : [...ratings].sort((a, b) => b.rating - a.rating).slice(0, 5);

  return (
    <div className={`space-y-5 ${expanded ? '' : ''}`}>
      {/* Dish Ratings Bar Chart */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-white">{expanded ? 'Full Ratings Analytics' : 'Top Rated Dishes'}</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {expanded ? 'Comprehensive breakdown of all meal feedback' : 'Top 5 performing dishes this month'}
            </p>
          </div>
          <div className="text-2xl">⭐</div>
        </div>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-40 rounded-2xl bg-white/5 border border-white/8" />
          </div>
        ) : !hasData ? (
          <div className="text-center py-10 space-y-3">
            <div className="text-4xl">📊</div>
            <p className="text-white/60 text-sm font-medium">No ratings yet</p>
            <p className="text-white/40 text-xs">Ratings will appear here once students start rating their meals.</p>
          </div>
        ) : (
          <>
            {/* Top dish highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              {[
                { label: '✅ Best Rated Dish', dish: bestRated?.dish ?? '—', score: bestRated ? bestRated.rating.toFixed(1) : '—', color: 'text-yellow-400' },
                { label: '✅ Most Voted Dish', dish: mostVoted?.dish ?? '—', score: mostVoted ? `${mostVoted.votes} votes` : '—', color: 'text-cyan-400' },
                { label: '✅ Needs Improvement Dish', dish: needsWork?.dish ?? '—', score: needsWork ? needsWork.rating.toFixed(1) : '—', color: 'text-red-400' },
              ].map(h => (
                <div key={`highlight-${h.label}`} className="glass-card p-3 text-center">
                  <p className="text-[10px] sm:text-xs text-[hsl(var(--muted-foreground))] mb-1">{h.label}</p>
                  <p className="text-sm font-semibold text-white truncate" title={h.dish}>{shortenDishName(h.dish)}</p>
                  <p className={`text-sm font-bold font-mono ${h.color}`}>{h.score}</p>
                </div>
              ))}
            </div>

            {!expanded && (
              <div className="mb-4">
                <p className="text-[10px] text-white/40 uppercase tracking-widest mb-3">Top 5 Dishes</p>
              </div>
            )}

            {expanded && (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ratings} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="dish"
                    tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    tickLine={false}
                    tickFormatter={(val) => val.length > 15 ? val.substring(0, 12) + '...' : val}
                  />
                  <YAxis
                    domain={[0, 5]}
                    tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="rating" name="Rating" radius={[6, 6, 0, 0]} fill="url(#ratingGradient)" />
                  <defs>
                    <linearGradient id="ratingGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity={1} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* Dish list with ratings */}
            <div className="mt-2 space-y-2">
              {displayedRatings.map(dish => (
                <div key={dish.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors group">
                  <span className="text-lg w-7 flex-shrink-0">{dish.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm text-white/80 truncate pr-2" title={dish.dish}>
                        {shortenDishName(dish.dish)}
                      </span>
                      <span className="text-sm font-bold font-mono text-white">{dish.rating.toFixed(1)}</span>
                    </div>
                    <div className="progress-bar h-1.5">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${(dish.rating / 5) * 100}%`,
                          background: dish.rating >= 4.5 ? '#22c55e' : dish.rating >= 4.0 ? '#06b6d4' : dish.rating >= 3.5 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono w-14 text-right flex-shrink-0">
                    {dish.votes} v
                  </span>
                </div>
              ))}
            </div>

            {!expanded && ratings.length > 5 && (
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                <p className="text-[11px] text-white/40">Showing Top 5 of {ratings.length} dishes</p>
                <button
                  onClick={() => window.location.search = '?section=ratings'}
                  className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                >
                  View Full History →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {expanded && (
        <div className="glass-card p-5 space-y-5">
          <h3 className="text-base font-bold text-white">Rating Trends</h3>
          {!hasData ? (
            <div className="text-center py-8 space-y-2">
              <div className="text-3xl">📈</div>
              <p className="text-white/50 text-sm">Not enough data for trend analysis</p>
              <p className="text-white/30 text-xs">Weekly trends will appear after at least 7 days of ratings.</p>
            </div>
          ) : (
            <>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/50 uppercase tracking-[0.24em] mb-3">Weekly average</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
                    <YAxis domain={[0, 5]} tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}/5`} />
                    <Legend wrapperStyle={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }} />
                    <Line type="monotone" dataKey="avgRating" name="Avg Rating" stroke="#22d3ee" strokeWidth={2.5} dot={{ fill: '#22d3ee', r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/50 uppercase tracking-[0.24em] mb-3">Meal type breakdown</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {mealTypeData.map((row) => (
                    <div key={row.mealType} className="rounded-2xl bg-slate-950/70 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-white/80 capitalize">{row.mealType}</p>
                        <span className="text-xs text-white/50">{row.totalRatings} ratings</span>
                      </div>
                      <div className="mt-3 text-2xl font-bold text-white">{row.avgRating.toFixed(1)}</div>
                      <div className="h-2 mt-3 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(100, (row.avgRating / 5) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-indigo-500/8 border border-indigo-500/20">
                <p className="text-xs text-indigo-300 font-semibold mb-1">📊 Live Data Summary</p>
                <p className="text-xs text-white/60">
                  {ratings.length} dish{ratings.length !== 1 ? 'es' : ''} rated so far.
                  Average rating: {(ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)}/5.
                  Total feedback: {ratings.reduce((sum, r) => sum + r.votes, 0)} ratings.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}