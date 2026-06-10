'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getIstDateString } from '@/lib/utils/mealStatus';

interface MealToRate {
  id: string;
  meal: string;
  mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner';
  dish: string;
  time: string;
  endTime: string;
}

const MEALS_TO_RATE: MealToRate[] = [
  { id: 'rate-breakfast', meal: 'Breakfast', mealType: 'breakfast', dish: '...', time: '7:30 AM', endTime: '9:00 AM' },
  { id: 'rate-lunch', meal: 'Lunch', mealType: 'lunch', dish: '...', time: '12:30 PM', endTime: '2:30 PM' },
  { id: 'rate-snack', meal: 'Snack', mealType: 'snack', dish: '...', time: '4:30 PM', endTime: '5:30 PM' },
  { id: 'rate-dinner', meal: 'Dinner', mealType: 'dinner', dish: '...', time: '7:30 PM', endTime: '9:30 PM' },
];

const EMOJIS = [
  { emoji: '😀', label: 'Loved it', value: 5 },
  { emoji: '🙂', label: 'Good', value: 4 },
  { emoji: '😐', label: 'Okay', value: 3 },
  { emoji: '😞', label: 'Bad', value: 2 },
];

function parseTimeOnToday(label: string) {
  const now = new Date();
  const match = label.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return now;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toUpperCase();
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
}

export default function EmojiRatingSection() {
  const { user } = useAuth();
  const today = getIstDateString();

  const [meals, setMeals] = useState<MealToRate[]>(MEALS_TO_RATE);
  const [ratings, setRatings] = useState<Record<string, number | null>>({});
  const [wasteReports, setWasteReports] = useState<Record<string, string | null>>({});
  const [savingRating, setSavingRating] = useState<string | null>(null);

  // Initialize state based on meals
  useEffect(() => {
    const r: Record<string, number | null> = {};
    const w: Record<string, string | null> = {};
    meals.forEach(m => {
      r[m.id] = null;
      w[m.id] = null;
    });
    setRatings(r);
    setWasteReports(w);
  }, [meals]);

  const loadTodayMenu = useCallback(async () => {
    try {
      const response = await fetch(`/api/live/final-menu?date=${today}`);
      if (!response.ok) return;
      const data = await response.json();
      if (data?.rows && Array.isArray(data.rows)) {
        setMeals(prev => prev.map(m => {
          const mealData = data.rows.find((r: any) => r.mealType === m.mealType);
          if (mealData) {
            const winners = mealData.winningItems || [];
            const fixed = mealData.fixedItems || [];
            const dishNames = [
              ...winners.flatMap((wi: any) => wi.items && wi.items.length > 0 ? wi.items : [wi.label]),
              ...fixed
            ].filter(Boolean);

            if (dishNames.length > 0) {
              return {
                ...m,
                dish: dishNames.join(' + ')
              };
            }
          }
          // Better fallback than "..." if we have some data but no winners yet
          return { ...m, dish: `Today's ${m.meal}` };
        }));
      }
    } catch (err) {
      console.log('Load today menu error:', err);
    }
  }, [today]);

  const loadMyRatings = useCallback(async () => {
    if (!user) return;
    try {
      const response = await fetch(`/api/meal-ratings?date=${today}&studentId=${user.id}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { console.log('Load ratings error:', payload?.message || 'request failed'); return; }

      const ratingMap: Record<string, number | null> = {};
      const wasteMap: Record<string, string | null> = {};
      meals.forEach(m => {
        ratingMap[m.id] = null;
        wasteMap[m.id] = null;
      });

      (payload?.rows ?? []).forEach((row: any) => {
        const key = `rate-${row.meal_type}`;
        ratingMap[key] = row.rating;
        wasteMap[key] = row.waste_amount;
      });

      setRatings(prev => ({ ...prev, ...ratingMap }));
      setWasteReports(prev => ({ ...prev, ...wasteMap }));
    } catch (err: any) {
      console.log('Load ratings error:', err.message);
    }
  }, [user, today, meals]);

  useEffect(() => {
    loadTodayMenu();
  }, [loadTodayMenu]);

  useEffect(() => {
    loadMyRatings();
  }, [loadMyRatings]);

  const handleRate = async (mealId: string, value: number, emoji: string) => {
    if (!user) { toast.error('Please sign in to rate.'); return; }
    const meal = meals.find(m => m.id === mealId);
    if (!meal || meal.dish === '...') { 
      toast.error('Meal details not loaded yet. Please wait a moment.'); 
      return; 
    }

    setRatings(prev => ({ ...prev, [mealId]: value }));
    setSavingRating(mealId);

    try {
      const response = await fetch('/api/meal-ratings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: user.id,
          ratingDate: today,
          mealType: meal.mealType,
          dishName: meal.dish,
          rating: value,
          wasteAmount: wasteReports[mealId] || 'none',
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        console.log('Rating error:', payload?.message || 'request failed');
        toast.error('Failed to save rating. Please try again.');
        return;
      }

      toast.success(`Rated ${emoji} — thanks for your feedback!`);
    } catch (err: any) {
      console.log('Rating error:', err.message);
      toast.error('Failed to save rating.');
    } finally {
      setSavingRating(null);
    }
  };

  const handleWaste = async (mealId: string, amount: string) => {
    if (!user) return;
    const meal = meals.find(m => m.id === mealId);
    if (!meal) return;

    setWasteReports(prev => ({ ...prev, [mealId]: amount }));
    toast.info('Waste reported. Helps us reduce food waste! 🌱');

    // Update waste in DB if rating already exists
    if (!ratings[mealId]) return;
    try {
      await fetch('/api/meal-ratings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: user.id,
          ratingDate: today,
          mealType: meal.mealType,
          wasteAmount: amount,
        }),
      });
    } catch (err: any) {
      console.log('Waste update error:', err.message);
    }
  };

  return (
    <div className="glass-card p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white">Rate Your Meal</h2>
          <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))]">Your feedback improves tomorrow&apos;s food</p>
        </div>
        <span className="text-2xl">⭐</span>
      </div>

      {meals.map(meal => {
        const currentRating = ratings[meal.id];
        const currentWaste = wasteReports[meal.id];
        const isSaving = savingRating === meal.id;
        const mealEnd = parseTimeOnToday(meal.endTime);
        const mealStart = parseTimeOnToday(meal.time);
        
        const now = new Date();
        const isServed = now >= mealStart; 

        if (!isServed) {
          return (
            <div key={meal.id} className="p-4 rounded-xl bg-white/4 border border-white/8 text-center mb-4 opacity-70">
              <div className="text-3xl mb-2">🕘</div>
              <p className="text-sm font-semibold text-white">{meal.meal} ratings open at {meal.time}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Come back during or after service to rate today&apos;s meal.</p>
            </div>
          );
        }

        return (
          <div key={meal.id} className="space-y-4 mb-6 last:mb-0">
            <div className="p-3 sm:p-4 rounded-xl bg-white/4 border border-white/8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-white">{meal.meal}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{meal.dish} · Today, {meal.time}</p>
                </div>
                {isSaving ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : currentRating ? (
                  <div className="text-2xl">{EMOJIS.find(e => e.value === currentRating)?.emoji}</div>
                ) : null}
              </div>

              {/* Emoji buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {EMOJIS.map(e => (
                  <button
                    key={`${meal.id}-emoji-${e.value}`}
                    onClick={() => handleRate(meal.id, e.value, e.emoji)}
                    disabled={isSaving}
                    className={`emoji-btn min-w-0 disabled:opacity-60 ${currentRating === e.value ? 'selected' : ''}`}
                  >
                    <span className="text-2xl">{e.emoji}</span>
                    <span className="text-xs text-white/60">{e.label}</span>
                  </button>
                ))}
              </div>

              {/* Waste report */}
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">How much did you leave? (Plate waste)</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'none', label: '🍽️ None', value: 'none' },
                    { id: 'little', label: '🤏 A little', value: 'little' },
                    { id: 'half', label: '½ Half', value: 'half' },
                    { id: 'most', label: '😬 Most', value: 'most' },
                  ].map(w => (
                    <button
                      key={`${meal.id}-waste-${w.id}`}
                      onClick={() => handleWaste(meal.id, w.value)}
                      className={`flex-1 py-1.5 text-xs rounded-lg border transition-all ${
                        currentWaste === w.value
                          ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'bg-white/3 border-white/8 text-white/55 hover:bg-white/6'
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}