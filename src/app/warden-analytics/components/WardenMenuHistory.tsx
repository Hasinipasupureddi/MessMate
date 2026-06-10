'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronRight, Database, RefreshCw, CheckCircle2, TrendingUp, Utensils, Star, Trash2 } from 'lucide-react';
import { getIstDateString } from '@/lib/utils/mealStatus';

type MenuHistoryItem = {
  date: string;
  status: string;
  meals: Array<{ 
    mealType: string; 
    label: string; 
    items: string[]; 
    winnerSource?: string | null;
    overrideReason?: string | null;
    generatedAt?: string | null;
    updatedAt?: string | null;
  }>;
};

type FilterOption = 'last7' | 'last30' | 'custom';

const shortenDishName = (name: string) => {
  if (name.includes('+')) {
    return name.split('+')[0].trim() + ' Combo';
  }
  return name;
};

export default function WardenMenuHistory() {
  const [history, setHistory] = useState<MenuHistoryItem[]>([]);
  const [filter, setFilter] = useState<FilterOption>('last7');
  const [startDate, setStartDate] = useState(getIstDateString(-6));
  const [endDate, setEndDate] = useState(getIstDateString());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(3);
  const [kpis, setKpis] = useState<any>(null);

  const toggleExpand = (date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams();
      query.set('filter', filter);
      if (filter === 'custom') {
        query.set('startDate', startDate);
        query.set('endDate', endDate);
      }

      const [historyRes, kpiRes] = await Promise.all([
        fetch(`/api/warden/menu-history?${query.toString()}`),
        fetch(`/api/warden/kpis?date=${getIstDateString()}`)
      ]);

      const historyPayload = await historyRes.json().catch(() => null);
      const kpiPayload = await kpiRes.json().catch(() => null);

      if (!historyRes.ok) {
        throw new Error(historyPayload?.message || 'Unable to load menu history');
      }

      setHistory(Array.isArray(historyPayload.history) ? historyPayload.history : []);
      setKpis(kpiPayload);
    } catch (error: any) {
      setError(error?.message || 'Unable to load menu history');
    } finally {
      setLoading(false);
    }
  }, [filter, startDate, endDate]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const selectedDateRange = useMemo(() => {
    if (filter === 'last7') return 'Last 7 days';
    if (filter === 'last30') return 'Last 30 days';
    return `${startDate} → ${endDate}`;
  }, [filter, startDate, endDate]);

  const displayedHistory = history.slice(0, visibleCount);
  const daysReviewed = history.length;
  const mealsServed = history.reduce((acc, curr) => acc + curr.meals.length, 0);

  return (
    <div className="space-y-6">
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">Menu History</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Review and track menu decisions for your hostel.</p>
          </div>
          <button onClick={loadHistory} className="btn-glass inline-flex items-center gap-2 text-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            className={`btn-glass w-full text-sm ${filter === 'last7' ? 'bg-indigo-500/20 text-white border-indigo-500/30' : 'text-slate-300'}`}
            onClick={() => { setFilter('last7'); setVisibleCount(3); }}
          >
            Last 7 days
          </button>
          <button
            className={`btn-glass w-full text-sm ${filter === 'last30' ? 'bg-indigo-500/20 text-white border-indigo-500/30' : 'text-slate-300'}`}
            onClick={() => { setFilter('last30'); setVisibleCount(3); }}
          >
            Last 30 days
          </button>
          <button
            className={`btn-glass w-full text-sm ${filter === 'custom' ? 'bg-indigo-500/20 text-white border-indigo-500/30' : 'text-slate-300'}`}
            onClick={() => { setFilter('custom'); setVisibleCount(3); }}
          >
            Custom range
          </button>
        </div>

        {filter === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
            <label className="space-y-2 text-sm text-slate-300">
              Start date
              <input
                className="input-glass w-full"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                max={endDate}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              End date
              <input
                className="input-glass w-full"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                min={startDate}
                max={getIstDateString()}
              />
            </label>
          </div>
        )}

        <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4">
          <div className="text-xs uppercase tracking-[0.22em] text-white/40 mb-2 flex items-center gap-2">
            <CalendarDays size={14} /> Selected range
          </div>
          <p className="text-sm text-slate-300">{selectedDateRange}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Days Reviewed', value: daysReviewed, icon: <CalendarDays className="text-indigo-400" />, sub: 'In selected range' },
          { label: 'Meals Served', value: mealsServed, icon: <Utensils className="text-emerald-400" />, sub: 'Total menu counts' },
          { label: 'Avg Rating', value: kpis?.avgRating ? kpis.avgRating.toFixed(1) : '—', icon: <Star className="text-yellow-400" />, sub: 'Student feedback' },
          { label: 'Waste Saved', value: kpis?.totalWasteKg ? `${kpis.totalWasteKg.toFixed(1)}kg` : '—', icon: <Trash2 className="text-rose-400" />, sub: 'Month to date' },
        ].map((card, i) => (
          <div key={i} className="glass-card p-4 flex flex-col items-center text-center">
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mb-2">
              {card.icon}
            </div>
            <div className="text-xl font-bold text-white">{card.value}</div>
            <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold mt-1">{card.label}</div>
            <div className="text-[9px] text-white/20 mt-1">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* History Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest">Recent Menu Decisions</h3>
          <span className="text-[10px] text-white/30 font-bold">{history.length} records found</span>
        </div>

        {loading && history.length === 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 rounded-3xl bg-white/5 animate-pulse border border-white/10" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-center">
            <p className="text-rose-200 text-sm mb-2">{error}</p>
            <button onClick={loadHistory} className="text-xs text-rose-400 font-bold underline">Try again</button>
          </div>
        ) : history.length === 0 ? (
          <div className="glass-card p-10 text-center space-y-3">
            <div className="text-4xl">📂</div>
            <p className="text-white/60 text-sm font-medium">No menu history for this period</p>
            <p className="text-white/40 text-xs">Try selecting a different date range.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {displayedHistory.map((item) => (
              <div key={`card-${item.date}`} className="glass-card p-5 flex flex-col border-white/10 bg-slate-950/40 hover:bg-slate-950/60 transition-all group">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm font-bold text-white">{item.date}</div>
                    <div className={`text-[10px] uppercase tracking-[0.2em] font-bold mt-1 ${
                      item.status === 'Approved' ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {item.status}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/20 group-hover:text-indigo-400 transition-colors">
                    <Database size={16} />
                  </div>
                </div>

                <div className="space-y-3 flex-1">
                  {item.meals.map((meal) => (
                    <div key={`${item.date}-${meal.mealType}`} className="p-3 rounded-2xl bg-white/5 border border-white/5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] uppercase tracking-widest text-white/30 font-bold">{meal.mealType}</span>
                        {meal.winnerSource === 'staff_override' && (
                          <span className="text-[8px] text-amber-400 font-bold">Staff Override</span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-white truncate" title={meal.label}>
                        {shortenDishName(meal.label)}
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => toggleExpand(item.date)}
                  className="w-full mt-5 py-2.5 rounded-2xl border border-white/10 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all flex items-center justify-center gap-2"
                >
                  View Details <ChevronRight size={14} className={expandedDates.has(item.date) ? 'rotate-90' : ''} />
                </button>

                {expandedDates.has(item.date) && (
                  <div className="mt-4 pt-4 border-t border-white/5 space-y-3 animate-in fade-in slide-in-from-top-2">
                    {item.meals.map(meal => (
                      <div key={`detail-${meal.mealType}`} className="text-[10px] text-slate-400 italic">
                        <span className="font-bold text-slate-500 mr-2">{meal.mealType}:</span>
                        {meal.items.join(' + ')}
                      </div>
                    ))}
                    <div className="text-[9px] text-slate-600 pt-2 border-t border-white/5">
                      Finalized at {new Date(item.meals[0]?.updatedAt || '').toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && history.length > visibleCount && (
          <div className="flex justify-center pt-4">
            <button 
              onClick={() => setVisibleCount(prev => prev + 6)}
              className="px-8 py-3 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-xs font-bold uppercase tracking-widest hover:bg-indigo-600/30 transition-all"
            >
              Load Older Records
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
