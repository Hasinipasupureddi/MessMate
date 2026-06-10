'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Users, TrendingUp, CheckCircle2, Clock, Coffee } from 'lucide-react';
import { getIstDateString } from '@/lib/utils/mealStatus';

type MealCount = {
  meal_type: 'breakfast' | 'lunch' | 'snack' | 'dinner';
  confirmed: number;
  skipped: number;
};

type CardData = {
  id: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  trend: string;
  trendUp: boolean;
  cardClass: string;
  iconBg: string;
  iconColor: string;
};

export default function StaffKPIRow() {
  const today = getIstDateString();
  const [cards, setCards] = useState<CardData[]>([
    {
      id: 'kpi-breakfast',
      icon: <Users size={20} />,
      label: 'Breakfast Opt-ins',
      value: '—',
      sub: 'live confirmed count',
      trend: 'Loading...',
      trendUp: true,
      cardClass: 'gradient-card-blue',
      iconBg: 'bg-indigo-500/20',
      iconColor: 'text-indigo-400',
    },
    {
      id: 'kpi-lunch',
      icon: <TrendingUp size={20} />,
      label: 'Lunch Opt-ins',
      value: '—',
      sub: 'live confirmed count',
      trend: 'Loading...',
      trendUp: true,
      cardClass: 'gradient-card-cyan',
      iconBg: 'bg-cyan-500/20',
      iconColor: 'text-cyan-400',
    },
    {
      id: 'kpi-snack',
      icon: <Coffee size={20} />,
      label: 'Snack Opt-ins',
      value: '—',
      sub: 'live confirmed count',
      trend: 'Loading...',
      trendUp: true,
      cardClass: 'gradient-card-purple',
      iconBg: 'bg-purple-500/20',
      iconColor: 'text-purple-400',
    },
    {
      id: 'kpi-dinner',
      icon: <CheckCircle2 size={20} />,
      label: 'Dinner Opt-ins',
      value: '—',
      sub: 'live confirmed count',
      trend: 'Loading...',
      trendUp: true,
      cardClass: 'gradient-card-green',
      iconBg: 'bg-green-500/20',
      iconColor: 'text-green-400',
    },
    {
      id: 'kpi-total',
      icon: <Clock size={20} />,
      label: 'Total Meal Responses',
      value: '—',
      sub: 'today across all meals',
      trend: 'Loading...',
      trendUp: true,
      cardClass: 'gradient-card-orange',
      iconBg: 'bg-orange-500/20',
      iconColor: 'text-orange-400',
    },
  ]);

  const loadMetrics = useCallback(async () => {
    try {
      const response = await fetch(`/api/meal-optins?date=${today}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        return;
      }

      const counts: Record<'breakfast' | 'lunch' | 'snack' | 'dinner', MealCount> = {
        breakfast: { meal_type: 'breakfast', confirmed: 0, skipped: 0 },
        lunch: { meal_type: 'lunch', confirmed: 0, skipped: 0 },
        snack: { meal_type: 'snack', confirmed: 0, skipped: 0 },
        dinner: { meal_type: 'dinner', confirmed: 0, skipped: 0 },
      };

      (payload?.rows ?? []).forEach((row: any) => {
        const mt = String(row.meal_type) as keyof typeof counts;
        if (!counts[mt]) return;
        counts[mt] = {
          meal_type: mt,
          confirmed: Number(row.confirmed || 0),
          skipped: Number(row.skipped || 0),
        };
      });

      const totalResponses = counts.breakfast.confirmed + counts.lunch.confirmed + counts.snack.confirmed + counts.dinner.confirmed;

      setCards([
        {
          id: 'kpi-breakfast',
          icon: <Users size={20} />,
          label: 'Breakfast Opt-ins',
          value: String(counts.breakfast.confirmed),
          sub: `${counts.breakfast.skipped} students skipped`,
          trend: 'Live from DB',
          trendUp: true,
          cardClass: 'gradient-card-blue',
          iconBg: 'bg-indigo-500/20',
          iconColor: 'text-indigo-400',
        },
        {
          id: 'kpi-lunch',
          icon: <TrendingUp size={20} />,
          label: 'Lunch Opt-ins',
          value: String(counts.lunch.confirmed),
          sub: `${counts.lunch.skipped} students skipped`,
          trend: 'Live from DB',
          trendUp: true,
          cardClass: 'gradient-card-cyan',
          iconBg: 'bg-cyan-500/20',
          iconColor: 'text-cyan-400',
        },
        {
          id: 'kpi-snack',
          icon: <Coffee size={20} />,
          label: 'Snack Opt-ins',
          value: String(counts.snack.confirmed),
          sub: `${counts.snack.skipped} students skipped`,
          trend: 'Live from DB',
          trendUp: true,
          cardClass: 'gradient-card-purple',
          iconBg: 'bg-purple-500/20',
          iconColor: 'text-purple-400',
        },
        {
          id: 'kpi-dinner',
          icon: <CheckCircle2 size={20} />,
          label: 'Dinner Opt-ins',
          value: String(counts.dinner.confirmed),
          sub: `${counts.dinner.skipped} students skipped`,
          trend: 'Live from DB',
          trendUp: true,
          cardClass: 'gradient-card-green',
          iconBg: 'bg-green-500/20',
          iconColor: 'text-green-400',
        },
        {
          id: 'kpi-total',
          icon: <Clock size={20} />,
          label: 'Total Meal Responses',
          value: String(totalResponses),
          sub: 'today across all meals',
          trend: totalResponses > 0 ? 'Shared state updated' : 'No responses yet',
          trendUp: true,
          cardClass: 'gradient-card-orange',
          iconBg: 'bg-orange-500/20',
          iconColor: 'text-orange-400',
        },
      ]);
    } catch {
      return;
    }
  }, [today]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {cards.map(kpi => (
        <div key={kpi.id} className={`glass-card p-5 ${kpi.cardClass}`}>
          <div className="flex items-start justify-between mb-3">
            <div className={`w-10 h-10 rounded-xl ${kpi.iconBg} flex items-center justify-center ${kpi.iconColor}`}>
              {kpi.icon}
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              kpi.trendUp ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'
            }`}>
              {kpi.trend}
            </span>
          </div>
          <div className="font-mono text-3xl font-bold text-white mb-1">{kpi.value}</div>
          <div className="text-xs font-semibold text-white/80 uppercase tracking-wide">{kpi.label}</div>
          <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{kpi.sub}</div>
        </div>
      ))}
    </div>
  );
}