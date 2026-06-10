'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';

type DishRatingRow = {
  dishName: string;
  avgRating: number;
  votes: number;
  emoji: string;
};

type RatingTrendRow = {
  date: string;
  avgRating: number;
  totalRatings: number;
};

const LOW_RATING_THRESHOLD = 3.0;

export default function SatisfactionMetrics() {
  const [hasMounted, setHasMounted] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [ratings, setRatings] = useState<DishRatingRow[]>([]);
  const [trendData, setTrendData] = useState<RatingTrendRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRatings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [dishRes, trendRes] = await Promise.all([
        fetch('/api/meal-ratings?aggregate=dish'),
        fetch('/api/meal-ratings?aggregate=trend'),
      ]);

      const dishPayload = await dishRes.json().catch(() => ({}));
      const trendPayload = await trendRes.json().catch(() => ({}));

      if (!dishRes.ok) {
        throw new Error(dishPayload?.message || 'Failed to load satisfaction ratings.');
      }
      if (!trendRes.ok) {
        throw new Error(trendPayload?.message || 'Failed to load satisfaction trends.');
      }

      const ratingsData = Array.isArray(dishPayload?.ratings) ? dishPayload.ratings : [];
      const trendRows = Array.isArray(trendPayload?.trend) ? trendPayload.trend : [];

      setRatings(ratingsData.map((item: any) => ({
        dishName: String(item.dishName || item.dish_name || 'Unknown'),
        avgRating: Number(item.avgRating || item.avg_rating || 0),
        votes: Number(item.votes || 0),
        emoji: String(item.emoji || '🍽️'),
      })));

      setTrendData(trendRows.map((item: any) => ({
        date: String(item.date || item.rating_date || ''),
        avgRating: Number(item.avgRating || item.avg_rating || 0),
        totalRatings: Number(item.totalRatings || item.total_ratings || 0),
      })));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setHasMounted(true);
    void loadRatings();
  }, [loadRatings]);

  const avgScore = useMemo(() => {
    if (!ratings.length) return 0;
    return Number((ratings.reduce((sum, item) => sum + item.avgRating, 0) / ratings.length).toFixed(1));
  }, [ratings]);

  const lowRatedDishes = useMemo(
    () => ratings.filter(item => item.avgRating <= LOW_RATING_THRESHOLD).sort((a, b) => a.avgRating - b.avgRating).slice(0, 3),
    [ratings]
  );

  const topRatedDishes = useMemo(
    () => ratings.slice().sort((a, b) => b.avgRating - a.avgRating).slice(0, 6),
    [ratings]
  );

  if (!hasMounted) {
    return (
      <div className="glass-card p-5 h-[300px] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Collapsible Guide */}
      <div className="glass-card border-indigo-500/20 bg-indigo-500/5 overflow-hidden">
        <button 
          onClick={() => setShowGuide(!showGuide)}
          className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Info size={18} />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-white">Satisfaction Guide</h3>
              <p className="text-[10px] text-indigo-300/60 uppercase tracking-widest font-semibold">How this dashboard works</p>
            </div>
          </div>
          {showGuide ? <ChevronUp size={20} className="text-white/40" /> : <ChevronDown size={20} className="text-white/40" />}
        </button>
        
        {showGuide && (
          <div className="px-5 pb-5 pt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-1">
              <p className="text-xs font-bold text-white/80">• Satisfaction Score:</p>
              <p className="text-[11px] text-white/50">Average rating across all submitted reviews.</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-white/80">• Best Rated Dish:</p>
              <p className="text-[11px] text-white/50">Highest rated meal combination.</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-white/80">• Most Voted Dish:</p>
              <p className="text-[11px] text-white/50">Meal with highest participation.</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-white/80">• Needs Attention:</p>
              <p className="text-[11px] text-white/50">Dishes receiving consistently lower ratings.</p>
            </div>
          </div>
        )}
      </div>

      <div className="glass-card p-[18px] sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white">Satisfaction Dashboard</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Ratings based on actual student feedback</p>
          </div>
          {loading && <span className="text-[11px] text-white/40 px-2 py-0.5 rounded-full bg-white/5">Loading...</span>}
        </div>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-14 rounded-2xl bg-white/5 border border-white/8" />
            <div className="h-48 rounded-2xl bg-white/5 border border-white/8" />
          </div>
        ) : error ? (
          <div className="text-center py-10 text-sm text-red-300">{error}</div>
        ) : ratings.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <div className="text-4xl">📊</div>
            <p className="text-white/60 text-sm font-medium">Insufficient rating data yet</p>
            <p className="text-white/40 text-xs max-w-md mx-auto">
              Student satisfaction metrics will appear once feedback is submitted for meals. Collect ratings for at least 7 days to unlock meaningful trends.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Overall Satisfaction</p>
                <div className="text-5xl font-bold font-mono text-white">{avgScore}</div>
                <p className="text-xs text-white/50 mt-2">Based on {ratings.length} distinct dish ratings</p>
              </div>

              <div className="space-y-3">
                {lowRatedDishes.length > 0 ? (
                  lowRatedDishes.map((dish) => (
                    <div key={dish.dishName} className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{dish.dishName}</div>
                          <div className="text-xs text-red-300">Below threshold ({dish.avgRating.toFixed(1)} / 5)</div>
                        </div>
                        <div className="font-mono text-base text-red-300">{dish.avgRating.toFixed(1)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-sm text-green-200">
                    No low-rated dishes detected yet. Continue collecting student ratings.
                  </div>
                )}
              </div>
            </div>

            <div className="glass-card p-4 bg-slate-950/20 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wider">Top rated dishes</p>
                  <p className="text-sm text-white/80">Based on average feedback</p>
                </div>
                <span className="text-[11px] text-white/40">Highest to lowest</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {topRatedDishes.map((dish) => (
                  <div key={dish.dishName} className="p-3 rounded-2xl bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-white">{dish.dishName}</div>
                        <div className="text-[11px] text-white/40">{dish.votes} ratings</div>
                      </div>
                      <div className="font-mono text-xl text-cyan-300">{dish.avgRating.toFixed(1)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {trendData.length > 0 && (
              <div className="glass-card p-4 bg-slate-950/20 border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-white/50 uppercase tracking-wider">Satisfaction trend</p>
                    <p className="text-sm text-white/80">Average dish ratings over the last week</p>
                  </div>
                  <span className="text-[11px] text-white/40">Live trend</span>
                </div>
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
