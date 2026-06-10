'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Leaf, Droplets, Utensils, Globe, Users } from 'lucide-react';
import { getIstDateString } from '@/lib/utils/mealStatus';

interface SustainabilityData {
  totalWasteKg: number;
  totalOptins: number;
  totalUniqueParticipants: number;
  totalStudents: number;
  leftoversClaimed: number;
}

export default function SustainabilityKPIs() {
  const [data, setData] = useState<SustainabilityData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const today = getIstDateString();
      
      // Fetch from warden KPI endpoint (which reads real DB aggregates)
      const response = await fetch(`/api/warden/kpis?date=${today}`);
      const payload = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        setLoading(false);
        return;
      }

      // Fetch leftover claims count
      const leftoverRes = await fetch('/api/leftovers');
      const leftoverPayload = await leftoverRes.json().catch(() => ({}));
      const claimedCount = Array.isArray(leftoverPayload?.rows)
        ? leftoverPayload.rows.filter((r: any) => r.status === 'claimed').length
        : 0;

      setData({
        totalWasteKg: Number(payload?.totalWasteKg || 0),
        totalOptins: Number(payload?.totalOptins || 0),
        totalUniqueParticipants: Number(payload?.totalUniqueParticipants || 0),
        totalStudents: Number(payload?.totalStudents || 0),
        leftoversClaimed: claimedCount,
      });
    } catch {
      // non-blocking
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const hasActivity = data && (data.totalWasteKg > 0 || data.leftoversClaimed > 0 || data.totalUniqueParticipants > 0);
  const participationRate = data && data.totalStudents > 0
    ? Math.min(100, Math.round((data.totalUniqueParticipants / data.totalStudents) * 100))
    : 0;

  const kpis = [
    {
      id: 'sk-waste',
      icon: <Leaf size={20} />,
      label: 'Food Waste Logged',
      value: data ? (data.totalWasteKg > 0 ? `${data.totalWasteKg.toFixed(1)} kg` : '0 kg') : '—',
      sub: 'today',
      detail: data?.totalWasteKg ? 'From staff waste logs' : 'No waste logged yet',
      color: 'text-green-400',
      bg: 'gradient-card-green',
      iconBg: 'bg-green-500/20',
      iconColor: 'text-green-400',
    },
    {
      id: 'sk-optins',
      icon: <Utensils size={20} />,
      label: 'Meal Confirmations',
      value: data ? String(data.totalOptins) : '—',
      sub: `confirmed today`,
      detail: data?.totalOptins ? `${data.totalOptins} meal confirmations` : 'Awaiting opt-ins',
      color: 'text-cyan-400',
      bg: 'gradient-card-cyan',
      iconBg: 'bg-cyan-500/20',
      iconColor: 'text-cyan-400',
    },
    {
      id: 'sk-participation',
      icon: <Users size={20} />,
      label: 'Student Participation',
      value: data ? `${participationRate}%` : '—',
      sub: data ? `${data.totalUniqueParticipants} of ${data.totalStudents || 0} students` : '—',
      detail: data?.totalUniqueParticipants ? 'Opted into at least one meal' : 'Awaiting participation',
      color: 'text-indigo-400',
      bg: 'gradient-card-blue',
      iconBg: 'bg-indigo-500/20',
      iconColor: 'text-indigo-400',
    },
    {
      id: 'sk-leftovers',
      icon: <Droplets size={20} />,
      label: 'Leftovers Claimed',
      value: data ? String(data.leftoversClaimed) : '—',
      sub: 'meals redistributed',
      detail: data?.leftoversClaimed ? 'Reducing food waste' : 'No claims yet',
      color: 'text-purple-400',
      bg: 'gradient-card-purple',
      iconBg: 'bg-purple-500/20',
      iconColor: 'text-purple-400',
    },
    {
      id: 'sk-students',
      icon: <Globe size={20} />,
      label: 'Registered Students',
      value: data ? String(data.totalStudents) : '—',
      sub: 'hostel capacity',
      detail: data?.totalStudents ? 'From user database' : 'Loading...',
      color: 'text-orange-400',
      bg: 'gradient-card-orange',
      iconBg: 'bg-orange-500/20',
      iconColor: 'text-orange-400',
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-3.5">
        {kpis.map(kpi => (
          <div key={kpi.id} className={`glass-card p-4 ${kpi.bg}`}>
            <div className="flex items-start justify-between mb-2.5">
              <div className={`w-9 h-9 rounded-xl ${kpi.iconBg} flex items-center justify-center ${kpi.iconColor}`}>
                {kpi.icon}
              </div>
              {loading && (
                <span className="text-[11px] text-white/40 px-2 py-0.5 rounded-full bg-white/5">Loading...</span>
              )}
            </div>
            <div className={`font-mono text-[1.7rem] font-bold ${kpi.color} mb-1`}>{kpi.value}</div>
            <div className="text-[11px] sm:text-xs font-semibold text-white/80 uppercase tracking-wide">{kpi.label}</div>
            <div className="text-[11px] sm:text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{kpi.sub}</div>
            <div className="text-[11px] sm:text-xs text-white/40 mt-1 italic">{kpi.detail}</div>
          </div>
        ))}
      </div>

      {/* Status message instead of fake charts */}
      <div className="glass-card p-5">
        <div className="mb-4">
          <h3 className="text-base font-bold text-white">Sustainability Dashboard</h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Environmental impact tracking from real hostel activity</p>
        </div>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-32 rounded-2xl bg-white/5 border border-white/8" />
          </div>
        ) : !hasActivity ? (
          <div className="text-center py-10 space-y-3">
            <div className="text-4xl">🌱</div>
            <p className="text-white/60 text-sm font-medium">Awaiting activity</p>
            <p className="text-white/40 text-xs max-w-md mx-auto">
              Sustainability metrics will appear here once staff begin logging waste,
              students opt into meals, and leftovers are claimed. All numbers are derived
              from actual hostel operations — no synthetic data.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-green-500/8 border border-green-500/20">
                <p className="text-xs text-green-400 font-semibold mb-1">🗑️ Waste Tracking</p>
                <p className="text-2xl font-bold font-mono text-white">{data!.totalWasteKg.toFixed(1)} kg</p>
                <p className="text-xs text-white/50 mt-1">Total food waste logged today by staff</p>
              </div>
              <div className="p-4 rounded-xl bg-cyan-500/8 border border-cyan-500/20">
                <p className="text-xs text-cyan-400 font-semibold mb-1">✅ Student Participation</p>
                <p className="text-2xl font-bold font-mono text-white">{participationRate}%</p>
                <p className="text-xs text-white/50 mt-1">{data!.totalUniqueParticipants} of {data!.totalStudents} students opted in</p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-indigo-500/8 border border-indigo-500/20">
              <p className="text-xs text-indigo-300 font-semibold mb-1">📊 Data Source</p>
              <p className="text-xs text-white/60">
                All metrics are computed from live database records: waste logs, meal opt-ins, and leftover claims.
                Historical trend charts will become available after 7+ days of consistent data logging.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
