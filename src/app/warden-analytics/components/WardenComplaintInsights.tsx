'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getIstDateString } from '@/lib/utils/mealStatus';

type ComplaintRow = {
  id: string;
  category: string;
  status: 'open' | 'in-progress' | 'resolved';
  createdAt: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  Quality: '#818cf8',
  Hygiene: '#22d3ee',
  Quantity: '#f59e0b',
  Service: '#a78bfa',
  Other: '#f472b6',
};

function formatDayLabel(date: string) {
  return new Date(`${date}T00:00:00+05:30`).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

export default function WardenComplaintInsights() {
  const today = getIstDateString();
  const [rows, setRows] = useState<ComplaintRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadComplaints = useCallback(async () => {
    try {
      const response = await fetch('/api/complaints?role=warden');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.log('Load warden complaints error:', payload?.message || 'request failed');
        return;
      }

      setRows(Array.isArray(payload?.rows) ? payload.rows : []);
    } catch (error: any) {
      console.log('Load warden complaints error:', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadComplaints();

    const id = window.setInterval(() => {
      void loadComplaints();
    }, 60000);

    return () => {
      window.clearInterval(id);
    };
  }, [loadComplaints]);

  const categories = useMemo(() => Array.from(new Set(rows.map(row => row.category))), [rows]);

  const chartData = useMemo(() => {
    const dates = Array.from({ length: 7 }, (_, index) => getIstDateString(index - 6));

    return dates.map(date => {
      const dayRows = rows.filter(row => row.createdAt.slice(0, 10) === date);
      const bucket: Record<string, number | string> = {
        date,
        label: formatDayLabel(date),
      };

      categories.forEach(category => {
        bucket[category] = dayRows.filter(row => row.category === category).length;
      });

      return bucket;
    });
  }, [categories, rows]);

  const openCount = rows.filter(row => row.status !== 'resolved').length;
  const resolvedCount = rows.filter(row => row.status === 'resolved').length;
  const thisWeekCount = rows.length;

  return (
    <div className="glass-card p-[18px] sm:p-5 space-y-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white">Complaint Volume</h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">7 day complaint trend grouped by category</p>
        </div>
        <div className="flex items-center gap-1.5 bg-amber-500/12 border border-amber-500/25 px-2.5 py-1 rounded-full text-amber-300 text-xs font-semibold">
          <AlertTriangle size={12} />
          {rows.length} total
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[1rem] border border-white/8 bg-white/4 p-3">
          <div className="text-xs text-white/45 uppercase tracking-wider font-semibold">Total open</div>
          <div className="text-2xl font-bold text-white mt-1">{openCount}</div>
        </div>
        <div className="rounded-[1rem] border border-white/8 bg-white/4 p-3">
          <div className="text-xs text-white/45 uppercase tracking-wider font-semibold">Resolved</div>
          <div className="text-2xl font-bold text-white mt-1">{resolvedCount}</div>
        </div>
        <div className="rounded-[1rem] border border-white/8 bg-white/4 p-3">
          <div className="text-xs text-white/45 uppercase tracking-wider font-semibold">This week</div>
          <div className="text-2xl font-bold text-white mt-1">{thisWeekCount}</div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-60 rounded-[1rem] bg-white/5 border border-white/8" />
          <div className="h-18 rounded-[1rem] bg-white/5" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-[1rem] border border-white/8 bg-white/4 p-3.5 text-sm text-[hsl(var(--muted-foreground))]">
          No complaints have been submitted yet.
        </div>
      ) : (
        <>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="label" stroke="rgba(255,255,255,0.35)" tick={{ fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.35)" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(15,23,42,0.96)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 12,
                    color: '#fff',
                  }}
                />
                {categories.map(category => (
                  <Bar
                    key={category}
                    dataKey={category}
                    stackId="complaints"
                    radius={[8, 8, 0, 0]}
                    fill={CATEGORY_COLORS[category] || '#818cf8'}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            {categories.map(category => (
              <span key={category} className="rounded-full border border-white/8 bg-white/4 px-2.5 py-1">
                {category}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            <CheckCircle2 size={12} className="text-emerald-400" />
            <span>Updated every 60 seconds for {today}</span>
          </div>
        </>
      )}
    </div>
  );
}
