'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getIstDateString } from '@/lib/utils/mealStatus';

interface Badge {
  id: string;
  emoji: string;
  name: string;
  description: string;
  earned: boolean;
  progress?: number;
  current?: number;
  target?: number;
}

interface BadgeResponse {
  badges: Badge[];
  impact: Array<{ value: string; label: string }>;
  summary: {
    streakCount: number;
    ratingCount: number;
    voteCount: number;
    leftoverClaimCount: number;
  };
}

type BadgeSource = 'streak' | 'ratings' | 'votes' | 'claims';

const BADGE_RULES: Record<string, { target: number; source: BadgeSource }> = {
  'badge-zerowaste': { target: 7, source: 'streak' },
  'badge-streak': { target: 10, source: 'streak' },
  'badge-critic': { target: 30, source: 'ratings' },
  'badge-voter': { target: 15, source: 'votes' },
  'badge-influencer': { target: 9, source: 'votes' },
  'badge-eco': { target: 5, source: 'claims' },
};

const DEFAULT_BADGES: Badge[] = [
  { id: 'badge-zerowaste', emoji: '🌱', name: 'Zero Waste', description: '7 days no plate waste', earned: true },
  { id: 'badge-streak', emoji: '🔥', name: 'Streak Master', description: '10-day meal streak', earned: true },
  { id: 'badge-critic', emoji: '⭐', name: 'Food Critic', description: 'Rate 30 meals', earned: true },
  { id: 'badge-voter', emoji: '🗳️', name: 'Democracy', description: 'Vote 15 times', earned: false, progress: 73 },
  { id: 'badge-influencer', emoji: '💫', name: 'Influencer', description: 'Top voter 3 times', earned: false, progress: 33 },
  { id: 'badge-eco', emoji: '♻️', name: 'Eco Hero', description: 'Save 5kg food waste', earned: false, progress: 60 },
];

export default function BadgesStrip() {
  const { user } = useAuth();
  const [badges, setBadges] = useState<Badge[]>(DEFAULT_BADGES);
  const [impact, setImpact] = useState<Array<{ value: string; label: string }>>([
    { value: '3.2kg', label: 'Food Saved' },
    { value: '₹180', label: 'Cost Saved' },
    { value: '1.4kg', label: 'CO₂ Reduced' },
  ]);
  const [summary, setSummary] = useState<BadgeResponse['summary']>({
    streakCount: 0,
    ratingCount: 0,
    voteCount: 0,
    leftoverClaimCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredBadgeId, setHoveredBadgeId] = useState<string | null>(null);
  const [pinnedBadgeId, setPinnedBadgeId] = useState<string | null>(null);

  const loadBadges = useCallback(async (signal?: AbortSignal) => {
    try {
      if (!user?.id) {
        setBadges(DEFAULT_BADGES);
        setImpact([
          { value: '3.2kg', label: 'Food Saved' },
          { value: '₹180', label: 'Cost Saved' },
          { value: '1.4kg', label: 'CO₂ Reduced' },
        ]);
        setSummary({ streakCount: 0, ratingCount: 0, voteCount: 0, leftoverClaimCount: 0 });
        return;
      }

      const date = getIstDateString();
      let response: Response;
      try {
        response = await fetch(`/api/student/badges?date=${date}`, { 
          cache: 'no-store',
          signal 
        });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setBadges(DEFAULT_BADGES);
        setImpact([
          { value: '3.2kg', label: 'Food Saved' },
          { value: '₹180', label: 'Cost Saved' },
          { value: '1.4kg', label: 'CO₂ Reduced' },
        ]);
        setSummary({ streakCount: 0, ratingCount: 0, voteCount: 0, leftoverClaimCount: 0 });
        return;
      }

      if (signal?.aborted) return;

      const payload = (await response.json().catch(() => ({}))) as Partial<BadgeResponse>;

      if (!response.ok) {
        return;
      }

      if (Array.isArray(payload.badges)) {
        setBadges(payload.badges);
      }

      if (Array.isArray(payload.impact)) {
        setImpact(payload.impact);
      }

      if (payload.summary) {
        setSummary(payload.summary);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const refresh = async () => {
      if (cancelled || controller.signal.aborted) {
        return;
      }
      await loadBadges(controller.signal);
    };

    void refresh();

    const intervalId = window.setInterval(() => {
      void refresh();
    }, 30000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadBadges]);

  const earnedCount = badges.filter((badge) => badge.earned).length;
  const inProgressCount = badges.length - earnedCount;
  const activeBadgeId = pinnedBadgeId ?? hoveredBadgeId;
  const activeBadge = badges.find((badge) => badge.id === activeBadgeId) ?? null;

  const getCurrentCount = (badgeId: string): number => {
    const rule = BADGE_RULES[badgeId];
    if (!rule) {
      return 0;
    }

    if (rule.source === 'streak') {
      return summary.streakCount;
    }
    if (rule.source === 'ratings') {
      return summary.ratingCount;
    }
    if (rule.source === 'votes') {
      return summary.voteCount;
    }
    return summary.leftoverClaimCount;
  };

  const getBadgeDetails = (badge: Badge) => {
    const rule = BADGE_RULES[badge.id];
    const current = badge.current ?? getCurrentCount(badge.id);
    const target = badge.target ?? rule?.target ?? 0;
    const remaining = Math.max(0, target - current);

    return {
      current,
      target,
      remaining,
      summary: remaining === 0 ? 'Unlocked' : `${remaining} more to unlock`,
    };
  };

  return (
    <div className="glass-card p-4 sm:p-5 mb-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white">My Badges</h2>
          <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))]">
            {earnedCount} earned · {inProgressCount} in progress
          </p>
        </div>
        <span className="text-2xl">🏆</span>
      </div>

      {isLoading && (
        <div className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">Updating live badge progress...</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {badges.map(badge => (
          <div
            key={badge.id}
            role="button"
            tabIndex={0}
            onMouseEnter={() => setHoveredBadgeId(badge.id)}
            onMouseLeave={() => setHoveredBadgeId((current) => (current === badge.id ? null : current))}
            onFocus={() => setHoveredBadgeId(badge.id)}
            onBlur={() => setHoveredBadgeId((current) => (current === badge.id ? null : current))}
            onClick={() => setPinnedBadgeId((current) => (current === badge.id ? null : badge.id))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setPinnedBadgeId((current) => (current === badge.id ? null : badge.id));
              }
            }}
            className={`cursor-pointer p-3 rounded-xl border text-center transition-all outline-none ${
              badge.earned
                ? 'bg-indigo-500/15 border-indigo-500/35 hover:border-indigo-400/60' :'bg-white/3 border-white/8 opacity-60 hover:border-white/20'
            }`}
          >
            <div className={`text-2xl mb-1 ${badge.earned ? '' : 'grayscale'}`}>{badge.emoji}</div>
            <p className={`text-xs font-semibold ${badge.earned ? 'text-white' : 'text-white/50'}`}>{badge.name}</p>
            {badge.earned ? (
              <p className="text-xs text-indigo-400 mt-0.5">Earned ✓</p>
            ) : badge.progress !== undefined ? (
              <div className="mt-1">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${badge.progress}%`, background: '#818cf8' }} />
                </div>
                <p className="text-xs text-white/35 mt-0.5">{badge.progress}%</p>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className={`mt-3 rounded-xl border px-3 py-3 text-xs transition-all ${
        activeBadge
          ? 'border-cyan-400/20 bg-cyan-400/8'
          : 'border-white/10 bg-white/4'
      }`}>
        {activeBadge ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  {activeBadge.emoji} {activeBadge.name}
                </p>
                <p className="mt-0.5 text-[hsl(var(--muted-foreground))]">{activeBadge.description}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                activeBadge.earned
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-cyan-500/15 text-cyan-300'
              }`}>
                {activeBadge.earned ? 'Unlocked' : 'In progress'}
              </span>
            </div>

            {!activeBadge.earned && (
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-[hsl(var(--muted-foreground))]">
                  <span>
                    {getBadgeDetails(activeBadge).current} / {getBadgeDetails(activeBadge).target}
                  </span>
                  <span>{getBadgeDetails(activeBadge).remaining} left</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${activeBadge.progress ?? 0}%`,
                      background: activeBadge.earned ? '#34d399' : '#22d3ee',
                    }}
                  />
                </div>
                <p className="text-[11px] text-cyan-300">{getBadgeDetails(activeBadge).summary}</p>
              </div>
            )}
          </>
        ) : (
          <p className="text-[hsl(var(--muted-foreground))]">Hover or tap a badge to see what&apos;s needed to unlock it.</p>
        )}
      </div>

      {/* Sustainability impact */}
      <div className="mt-3 p-3 sm:p-4 rounded-xl bg-green-500/8 border border-green-500/20">
        <p className="text-xs font-semibold text-green-400 mb-2">🌍 Your Sustainability Impact</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          {impact.map(stat => (
            <div key={`impact-${stat.label}`}>
              <div className="text-sm font-bold text-green-300 font-mono">{stat.value}</div>
              <div className="text-xs text-green-500/70">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">
        Live counts: {summary.streakCount} day streak, {summary.ratingCount} ratings, {summary.voteCount} votes, {summary.leftoverClaimCount} claims
      </div>
    </div>
  );
}