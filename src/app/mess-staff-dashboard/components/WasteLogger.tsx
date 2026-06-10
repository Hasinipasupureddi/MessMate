'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Leaf, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getIstDateString } from '@/lib/utils/mealStatus';

interface WasteEntry {
  id: string;
  meal: string;
  dish: string;
  amount: number;
  unit: string;
  reason: string;
  loggedAt: string;
}

interface WasteForm {
  meal: string;
  dish: string;
  amount: string;
  unit: string;
  reason: string;
}

export default function WasteLogger() {
  const { user } = useAuth();
  const today = getIstDateString();

  const [entries, setEntries] = useState<WasteEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<WasteForm>();

  const loadWasteLogs = useCallback(async () => {
    try {
      const response = await fetch(`/api/waste-logs?date=${today}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { console.log('Load waste logs error:', payload?.message || 'request failed'); return; }

      const mapped: WasteEntry[] = (payload?.rows ?? []).map((row: any) => ({
        id: row.id,
        meal: row.meal_type.charAt(0).toUpperCase() + row.meal_type.slice(1),
        dish: row.dish_name,
        amount: parseFloat(row.amount),
        unit: row.unit,
        reason: row.reason,
        loggedAt: new Date(row.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      }));

      setEntries(mapped);
    } catch (err: any) {
      console.log('Load waste logs error:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [today]);

  useEffect(() => {
    loadWasteLogs();
  }, [loadWasteLogs]);

  const onSubmit = async (data: WasteForm) => {
    if (!user) { toast.error('Please sign in to log waste.'); return; }

    try {
      const response = await fetch('/api/waste-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: user.id,
          logDate: today,
          mealType: data.meal.toLowerCase(),
          dishName: data.dish,
          amount: parseFloat(data.amount),
          unit: data.unit,
          reason: data.reason,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        console.log('Waste log error:', payload?.message || 'request failed');
        toast.error('Failed to log waste. Please try again.');
        return;
      }

      toast.success('Waste logged successfully. Sustainability score updated! 🌱');
      reset();
      setShowForm(false);
      loadWasteLogs();
    } catch (err: any) {
      console.log('Waste log error:', err.message);
      toast.error('Failed to log waste.');
    }
  };

  const totalWasteKg = entries.reduce((sum, e) => {
    if (e.unit === 'kg' || e.unit === 'litres') return sum + e.amount;
    if (e.unit === 'pcs') return sum + e.amount * 0.05;
    return sum;
  }, 0);

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-white">Waste Logger</h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Track and reduce food waste</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-green-500/12 border border-green-500/25 px-2.5 py-1 rounded-full">
            <Leaf size={12} className="text-green-400" />
            <span className="text-xs font-semibold text-green-400">{totalWasteKg.toFixed(1)} kg today</span>
          </div>
        </div>
      </div>

      {/* Recent entries */}
      <div className="space-y-2 mb-4">
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-16 rounded-xl bg-white/5 border border-white/8" />
            <div className="h-16 rounded-xl bg-white/5 border border-white/8" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-6">
            <Leaf size={28} className="text-green-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-white">No waste logged yet</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Great start — keep it up!</p>
          </div>
        ) : (
          entries.map(entry => (
            <div key={entry.id} className="p-3 rounded-xl bg-white/3 border border-white/8 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center flex-shrink-0">
                <span className="text-sm">🗑️</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{entry.dish}</span>
                  <span className="text-xs font-mono text-red-400">{entry.amount} {entry.unit}</span>
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{entry.reason}</p>
                <p className="text-xs text-white/30">{entry.meal} · {entry.loggedAt}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Log waste form */}
      {showForm ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 p-4 rounded-xl bg-white/3 border border-white/10">
          <p className="text-sm font-semibold text-white">Log Waste Entry</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/60 mb-1">Meal</label>
              <select className="input-glass text-sm" {...register('meal', { required: 'Required' })}>
                <option value="">Select</option>
                <option value="Breakfast">Breakfast</option>
                <option value="Lunch">Lunch</option>
                <option value="Snack">Snack</option>
                <option value="Dinner">Dinner</option>
              </select>
              {errors.meal && <p className="text-xs text-red-400 mt-0.5">{errors.meal.message}</p>}
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Dish Name</label>
              <input
                type="text"
                className="input-glass text-sm"
                placeholder="e.g. Sambar"
                {...register('dish', { required: 'Required' })}
              />
              {errors.dish && <p className="text-xs text-red-400 mt-0.5">{errors.dish.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/60 mb-1">Amount</label>
              <input
                type="number"
                step="0.1"
                className="input-glass text-sm"
                placeholder="0.0"
                {...register('amount', { required: 'Required', min: { value: 0.1, message: 'Min 0.1' } })}
              />
              {errors.amount && <p className="text-xs text-red-400 mt-0.5">{errors.amount.message}</p>}
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Unit</label>
              <select className="input-glass text-sm" {...register('unit', { required: 'Required' })}>
                <option value="">Select</option>
                <option value="kg">kg</option>
                <option value="litres">litres</option>
                <option value="pcs">pcs</option>
              </select>
              {errors.unit && <p className="text-xs text-red-400 mt-0.5">{errors.unit.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-1">Reason</label>
            <input
              type="text"
              className="input-glass text-sm"
              placeholder="e.g. Overcooked, excess preparation"
              {...register('reason', { required: 'Required' })}
            />
            {errors.reason && <p className="text-xs text-red-400 mt-0.5">{errors.reason.message}</p>}
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm py-2.5 disabled:opacity-60"
            >
              {isSubmitting ? (
                <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Logging...</span></>
              ) : (
                <span>Log Waste</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); reset(); }}
              className="btn-glass px-4 py-2.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="btn-glass w-full flex items-center justify-center gap-2 text-sm"
        >
          <Plus size={15} />
          <span>Log Waste Entry</span>
        </button>
      )}
    </div>
  );
}