'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Leaf, Users, Smile, Trash2, TrendingDown, TrendingUp, Utensils } from 'lucide-react';
import { getIstDateString } from '@/lib/utils/mealStatus';

interface KPIData {
  id: string;
  label: string;
  value: string;
  sub: string;
  trend: string;
  trendUp: boolean;
  cardClass: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
  trendIcon: React.ReactNode;
}

const DEFAULT_KPIS: KPIData[] = [
  {
    id: 'kpi-waste-saved',
    icon: <Leaf size={20} />,
    label: 'Food Waste Saved',
    value: '—',
    sub: 'this month vs last',
    trend: 'Loading...',
    trendUp: true,
    cardClass: 'gradient-card-green',
    iconBg: 'bg-green-500/20',
    iconColor: 'text-green-400',
    trendIcon: <TrendingDown size={12} />,
  },
  {
    id: 'kpi-participation',
    icon: <Users size={20} />,
    label: 'Student Participation',
    value: '—',
    sub: 'students opted in',
    trend: 'Live from DB',
    trendUp: true,
    cardClass: 'gradient-card-cyan',
    iconBg: 'bg-cyan-500/20',
    iconColor: 'text-cyan-400',
    trendIcon: <TrendingUp size={12} />,
  },
  {
    id: 'kpi-meal-confirmations',
    icon: <Utensils size={20} />,
    label: 'Meal Confirmations',
    value: '—',
    sub: 'confirmed opt-ins',
    trend: 'Live from DB',
    trendUp: true,
    cardClass: 'gradient-card-blue',
    iconBg: 'bg-indigo-500/20',
    iconColor: 'text-indigo-400',
    trendIcon: <TrendingUp size={12} />,
  },
  {
    id: 'kpi-satisfaction',
    icon: <Smile size={20} />,
    label: 'Satisfaction Score',
    value: '—',
    sub: 'avg across all meals',
    trend: 'Loading...',
    trendUp: true,
    cardClass: 'gradient-card-purple',
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-400',
    trendIcon: <TrendingUp size={12} />,
  },
  {
    id: 'kpi-total-waste',
    icon: <Trash2 size={20} />,
    label: 'Total Waste (Today)',
    value: '—',
    sub: 'across all meals',
    trend: 'Loading...',
    trendUp: true,
    cardClass: 'gradient-card-orange',
    iconBg: 'bg-orange-500/20',
    iconColor: 'text-orange-400',
    trendIcon: <TrendingDown size={12} />,
  },
];

export default function WardenKPIRow() {
  const today = getIstDateString();
  const [kpis, setKpis] = useState<KPIData[]>(DEFAULT_KPIS);

  const loadAnalytics = useCallback(async () => {
    try {
      const response = await fetch(`/api/warden/kpis?date=${today}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.log('Load analytics error:', payload?.message || 'request failed');
        return;
      }

      const totalWasteKg = Number(payload?.totalWasteKg || 0);
      const avgRating = Number(payload?.avgRating || 0);
      const totalOptins = Number(payload?.totalOptins || 0);
      const totalUniqueParticipants = Number(payload?.totalUniqueParticipants || 0);
      const totalStudents = Number(payload?.totalStudents || 0);
      const totalTomorrowVoters = Number(payload?.totalTomorrowVoters || 0);
      const dietCounts = payload?.dietCounts || { veg: 0, non_veg: 0 };
      const participationRate = totalStudents > 0 ? Math.min(100, Math.round((totalUniqueParticipants / totalStudents) * 100)) : 0;
      const votingParticipationRate = totalStudents > 0 ? Math.min(100, Math.round((totalTomorrowVoters / totalStudents) * 100)) : 0;

      setKpis(prev => prev.map(kpi => {
        if (kpi.id === 'kpi-waste-saved') {
          return {
            ...kpi,
            value: totalWasteKg > 0 ? `${totalWasteKg.toFixed(1)}kg` : '0.0kg',
            trend: totalWasteKg > 0 ? `${totalWasteKg.toFixed(1)}kg logged today` : 'No waste logged',
          };
        }
        if (kpi.id === 'kpi-participation') {
          return {
            ...kpi,
            label: 'Today\'s Participation',
            value: participationRate > 0 ? `${participationRate}%` : '—',
            sub: `${totalUniqueParticipants} of ${totalStudents} students`,
            trend: `🥬${dietCounts.veg} 🍗${dietCounts.non_veg}`,
          };
        }
        if (kpi.id === 'kpi-meal-confirmations') {
          return {
            ...kpi,
            label: 'Today\'s Confirmed Meals',
            value: totalOptins > 0 ? String(totalOptins) : '0',
            sub: 'confirmed opt-ins',
            trend: totalOptins > 0 ? `${totalOptins} meals confirmed` : 'No confirmations yet',
          };
        }
        if (kpi.id === 'kpi-satisfaction') {
          return {
            ...kpi,
            value: avgRating > 0 ? `${avgRating.toFixed(1)}/5` : '—',
            trend: avgRating > 0 ? `Based on today's ratings` : 'No ratings yet',
          };
        }
        if (kpi.id === 'kpi-total-waste') {
          return {
            ...kpi,
            label: 'Tomorrow Voting',
            icon: <TrendingUp size={20} />,
            value: votingParticipationRate > 0 ? `${votingParticipationRate}%` : '—',
            sub: `${totalTomorrowVoters} of ${totalStudents} students`,
            trend: `Participating in voting`,
            cardClass: 'gradient-card-orange',
            iconBg: 'bg-orange-500/20',
            iconColor: 'text-orange-400',
          };
        }
        return kpi;
      }));
    } catch (err: any) {
      console.log('Load analytics error:', err.message);
    }
  }, [today]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-3.5">
      {kpis?.map(kpi => (
        <div key={kpi?.id} className={`glass-card p-4 ${kpi?.cardClass}`}>
          <div className="flex items-start justify-between mb-2.5">
            <div className={`w-9 h-9 rounded-[0.9rem] ${kpi?.iconBg} flex items-center justify-center ${kpi?.iconColor}`}>
              {kpi?.icon}
            </div>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
              kpi?.trendUp ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'
            }`}>
              {kpi?.trendIcon}
              {kpi?.trend}
            </span>
          </div>
          <div className="font-mono text-2xl xl:text-[2rem] font-bold text-white mb-1">{kpi?.value}</div>
          <div className="text-[11px] sm:text-xs font-semibold text-white/80 uppercase tracking-wide">{kpi?.label}</div>
          <div className="text-[11px] sm:text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{kpi?.sub}</div>
        </div>
      ))}
    </div>
  );
}
