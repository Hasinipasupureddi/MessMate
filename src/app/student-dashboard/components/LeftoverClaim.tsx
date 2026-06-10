'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { AlertCircle, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getIstDateString, getIstNow, getIstTimeLabel, parseIstDatetime } from '@/lib/utils/mealStatus';

interface LeftoverItem {
  id: string;
  mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner';
  dish: string;
  emoji: string;
  quantity: string;
  availableUntil: string;
  claimed: boolean;
  claimedCount: number;
  totalPortions: number;
}

type DeclarationStatus = 'pending' | 'declared' | 'none';

type LeftoverDeclaration = {
  overallStatus: DeclarationStatus;
  meals: Array<{ meal_type: string; status: DeclarationStatus; note: string | null }>;
};

export default function LeftoverClaimSection() {
  const { user } = useAuth();

  const [leftovers, setLeftovers] = useState<LeftoverItem[]>([]);
  const [declaration, setDeclaration] = useState<LeftoverDeclaration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const requestIdRef = React.useRef(0);

  const loadLeftovers = useCallback(async (signal?: AbortSignal) => {
    const today = getIstDateString();
    const requestId = ++requestIdRef.current;

    try {
      if (signal?.aborted) {
        return;
      }

      const response = await fetch(`/api/leftover-items?date=${today}`, {
        cache: 'no-store',
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to load leftovers (Status: ${response.status})`);
      }

      if (signal?.aborted || requestId !== requestIdRef.current) {
        return;
      }

      const payload = await response.json();
      if (signal?.aborted || requestId !== requestIdRef.current) {
        return;
      }

      console.log(`[LEFTOVER DEBUG] RAW API DATA FOR ${today}:`, JSON.stringify(payload, null, 2));

      const now = new Date();
      console.log(`[LEFTOVER DEBUG] Client 'now' time:`, now.toISOString(), now.toLocaleString());

      // Important: MySQL stores in IST, but JS new Date() might interpret as local/UTC.
      // We need to be careful with comparison. 
      const mapped: LeftoverItem[] = (payload?.rows ?? []).map((row: any) => {
        const remaining = Math.max(0, row.total_portions - row.claimed_count);
        
        // Convert the MySQL DATETIME string (which is IST) into an IST-aware timestamp.
        const availableDate = parseIstDatetime(String(row.available_until));
        
        const closed = availableDate <= getIstNow() || remaining <= 0;

        console.log(`[LEFTOVER DEBUG] Item: ${row.dish_name}`, {
          available_until: row.available_until,
          parsed_date: availableDate.toISOString(),
          is_closed: closed,
          remaining: remaining
        });

        return {
          id: row.id,
          mealType: row.meal_type,
          dish: row.dish_name,
          emoji: row.emoji,
          quantity: `${remaining} portions`,
          availableUntil: getIstTimeLabel(availableDate),
          claimed: closed,
          claimedCount: row.claimed_count,
          totalPortions: row.total_portions,
        };
      });

      if (signal?.aborted || requestId !== requestIdRef.current) {
        return;
      }

      setLeftovers(mapped);
      if (payload?.declaration) {
        setDeclaration({
          overallStatus: payload.declaration.overallStatus,
          meals: Array.isArray(payload.declaration.meals) ? payload.declaration.meals.map((meal: any) => ({
            meal_type: meal.meal_type,
            status: meal.status,
            note: meal.note ?? null,
          })) : [],
        });
      } else {
        setDeclaration(null);
      }
    } catch (error: unknown) {
      if (signal?.aborted || (error as { name?: string })?.name === 'AbortError') {
        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Failed to fetch') {
        return;
      }

      console.error('[RCI] Error loading leftovers:', error);
      if (requestId === requestIdRef.current) {
        setLeftovers([]);
        setDeclaration(null);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    void loadLeftovers(controller.signal);

    const intervalId = window.setInterval(() => {
      if (cancelled || controller.signal.aborted) return;
      void loadLeftovers(controller.signal);
    }, 30000);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [loadLeftovers]);

  const handleClaim = async (id: string) => {
    if (!user?.id) {
      toast.error('Please sign in to claim leftovers.');
      return;
    }

    const response = await fetch('/api/leftover-claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leftoverId: id, userId: user.id }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.success) {
      toast.error(result?.message || 'Failed to claim portion.');
      await loadLeftovers();
      return;
    }

    toast.success('Portion claimed! Collect within 15 mins.');
    await loadLeftovers();
  };

  const available = useMemo(() => leftovers.filter(l => !l.claimed), [leftovers]);

  if (isLoading) {
    return (
      <div className="glass-card p-4 sm:p-5">
        <div className="text-center py-4 text-sm sm:text-[15px] text-[hsl(var(--muted-foreground))]">Loading available leftovers...</div>
      </div>
    );
  }

  if (available.length === 0) {
    const statusLabel = declaration?.overallStatus === 'none'
      ? 'No extra food available today'
      : declaration?.overallStatus === 'pending'
      ? 'Leftover declaration pending'
      : 'No extra food right now';

    const statusHint = declaration?.overallStatus === 'none'
      ? 'Mess staff have confirmed that no extra portions are available for today.'
      : declaration?.overallStatus === 'pending'
      ? 'The kitchen team is currently recording leftover availability. Please check back later.'
      : 'All declared portions have been claimed or have expired. We’ll notify you when more becomes available.';

    return (
      <div className="glass-card p-4 sm:p-5 border border-white/10 bg-white/5 relative overflow-hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-2xl shrink-0">
              {declaration?.overallStatus === 'pending' ? '⏳' : declaration?.overallStatus === 'declared' ? '✅' : '🌱'}
            </div>
            <div>
              <p className="text-sm font-bold text-white uppercase tracking-tight">{statusLabel}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 leading-relaxed max-w-[280px]">{statusHint}</p>
            </div>
          </div>
          <div className={`mt-2 sm:mt-0 self-start sm:self-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest border ${
            declaration?.overallStatus === 'none'
              ? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
              : declaration?.overallStatus === 'declared'
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}>
            {declaration?.overallStatus === 'none'
              ? 'OFFICIAL: NONE'
              : declaration?.overallStatus === 'declared'
              ? 'STATUS: DECLARED'
              : 'STATUS: PENDING'}
          </div>
        </div>
        {/* Subtle background decoration */}
        <div className="absolute -bottom-4 -right-4 text-6xl opacity-[0.03] pointer-events-none rotate-12">
          {declaration?.overallStatus === 'pending' ? '📋' : '🍽️'}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white">Extra Food Available 🎁</h2>
          <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))]">Claim before it&apos;s gone — reduces waste!</p>
        </div>
        <div className="flex items-center gap-1 bg-amber-500/15 border border-amber-500/25 px-2 py-1 rounded-full">
          <AlertCircle size={12} className="text-amber-400" />
          <span className="text-xs font-semibold text-amber-400">{available.length} items</span>
        </div>
      </div>

      <div className="space-y-3">
        {leftovers.map(item => {
          const remainPct = Math.round(((item.totalPortions - item.claimedCount) / item.totalPortions) * 100);
          return (
            <div key={item.id} className={`p-3 sm:p-4 rounded-xl border transition-all ${
              item.claimed
                ? 'bg-green-500/8 border-green-500/20 opacity-60' :'bg-amber-500/8 border-amber-500/25'
            }`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-2">
                  <div className="flex items-start gap-2">
                  <span className="text-xl">{item.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.dish}</p>
                    <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                      <Clock size={10} />
                      <span>Until {item.availableUntil}</span>
                    </div>
                  </div>
                </div>
                {item.claimed ? (
                  <span className="text-xs bg-green-500/20 text-green-400 px-2.5 py-1 rounded-full font-semibold">Claimed ✓</span>
                ) : (
                  <button
                    onClick={() => handleClaim(item.id)}
                    className="text-xs bg-amber-500/20 border border-amber-500/40 text-amber-300 px-3 py-1.5 rounded-lg font-semibold hover:bg-amber-500/30 active:scale-95 transition-all"
                  >
                    Claim
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))] mb-1">
                <span>{item.totalPortions - item.claimedCount} of {item.totalPortions} left</span>
                <span>{remainPct}% remaining</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${remainPct}%`, background: '#f59e0b' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}