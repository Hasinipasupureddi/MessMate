'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import StudentTopBar from './StudentTopBar';
import TodayMealCards from './TodayMealCard';
import TomorrowOptInPrompt from './TomorrowOptInPrompt';
import VotingWidget from './VotingWidget';
import EmojiRatingSection from './EmojiRatingSection';
import LeftoverClaimSection from './LeftoverClaim';
import ComplaintBox from './ComplaintBox';
import BadgesStrip from './BadgesStrip';
import StudentBottomNav from './StudentBottomBar';
import { formatIstDateLabel, getIstDateString } from '@/lib/utils/mealStatus';
import { normalizeDietPreference } from '@/lib/menu/masterMenu';
import { joinRoleRoom, leaveRoleRoom, subscribeSocketEvent, SOCKET_EVENTS } from '@/lib/socket/client';
import { cacheGeneratedMenuDay } from '@/lib/menu/generatedMenuCache';

export default function StudentDashboardClient() {
  const router = useRouter();
  const { user, reloadCurrentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'home' | 'menu' | 'vote' | 'history'>('home');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    // Refresh session on dashboard mount only when we already have a user.
    // This avoids clearing client auth state during a sign-in redirect when the cookie may not be attached yet.
    const syncSession = async () => {
      if (user && typeof reloadCurrentUser === 'function') {
        await reloadCurrentUser();
      }
    };
    syncSession();

    const savedTheme = window.localStorage.getItem('student-dashboard-theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme);
    }
  }, [user, reloadCurrentUser]);

  useEffect(() => {
    window.localStorage.setItem('student-dashboard-theme', theme);
  }, [theme]);

  useEffect(() => {
    joinRoleRoom('student');
    return () => {
      leaveRoleRoom('student');
    };
  }, []);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Enforce dietary preference selection
  if (user && !user.foodPreference) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${theme === 'dark' ? 'student-theme-dark' : 'student-theme-light'}`} style={{ background: 'var(--student-bg-main)' }}>
        <div className="glass-card p-8 max-w-md w-full text-center space-y-6">
          <div className="text-5xl">🥗</div>
          <h2 className="text-2xl font-bold text-white">Set Your Preference</h2>
          <p className="text-[hsl(var(--muted-foreground))]">
            Please set your food preference to continue to your dashboard. This helps us personalize your menu.
          </p>
          <button
            onClick={() => router.push('/profile')}
            className="w-full py-3 rounded-xl gradient-primary text-white font-bold shadow-lg shadow-indigo-500/20"
          >
            Set Preference
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'student-theme-dark' : 'student-theme-light'}`} style={{ background: 'var(--student-bg-main)' }}>
      <Toaster position="top-center" richColors />

      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute -top-40 -left-40 w-96 h-96 rounded-full ${theme === 'dark' ? 'opacity-20' : 'opacity-25'}`}
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }} />
        <div className={`absolute -top-20 right-0 w-80 h-80 rounded-full ${theme === 'dark' ? 'opacity-15' : 'opacity-20'}`}
          style={{ background: 'radial-gradient(circle, #22d3ee 0%, transparent 70%)' }} />
        <div className={`absolute bottom-40 -right-20 w-72 h-72 rounded-full ${theme === 'dark' ? 'opacity-10' : 'opacity-16'}`}
          style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 w-full max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 xl:px-10 pb-28 lg:pb-12">
        <StudentTopBar theme={theme} onToggleTheme={toggleTheme} />

        <div className={`${activeTab === 'home' ? 'block' : 'hidden'} mt-3 sm:mt-4 animate-fade-in`}>
          {user?.id && <TomorrowOptInPrompt studentId={user.id} />}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.88fr)] xl:items-start">
            <div className="space-y-4 sm:space-y-5">
              <TodayMealCards />
              <EmojiRatingSection />
              <LeftoverClaimSection />
            </div>

            <div className="space-y-4 sm:space-y-5 xl:sticky xl:top-28">
              <VotingWidget />
              <ComplaintBox />
              <BadgesStrip />
            </div>
          </div>
        </div>

        <div className={`${activeTab === 'menu' ? 'block' : 'hidden'} animate-fade-in`}>
          <WeeklyMenuView />
        </div>

        <div className={`${activeTab === 'vote' ? 'block' : 'hidden'} animate-fade-in`}>
          <VotingWidget expanded />
        </div>

        <div className={`${activeTab === 'history' ? 'block' : 'hidden'} animate-fade-in`}>
          <MealActivityView />
        </div>
      </div>

      <StudentBottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

function WeeklyMenuView() {
  const { user } = useAuth();
  const dietPreference = useMemo(() => normalizeDietPreference(user?.foodPreference), [user?.foodPreference]);
  
  const today = getIstDateString();
  const tomorrow = getIstDateString(1);

  const todayLabel = formatIstDateLabel(new Date(`${today}T00:00:00.000Z`), {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

  const tomorrowLabel = formatIstDateLabel(new Date(`${tomorrow}T00:00:00.000Z`), {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

  const [todayMenu, setTodayMenu] = useState<{ status: string; meals: any[] }>({ status: 'approved', meals: [] });
  const [tomorrowMenu, setTomorrowMenu] = useState<{ status: string; meals: any[] }>({ status: 'awaiting_approval', meals: [] });
  const [loading, setLoading] = useState(true);

  const loadMenuData = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const [todayRes, tomorrowRes] = await Promise.all([
        fetch(`/api/live/final-menu?date=${today}&pref=${dietPreference}`, { signal }),
        fetch(`/api/live/final-menu?date=${tomorrow}&pref=${dietPreference}`, { signal }),
      ]);

      if (signal?.aborted) return;

      const todayPayload = await todayRes.json().catch(() => ({}));
      const tomorrowPayload = await tomorrowRes.json().catch(() => ({}));

      if (todayRes.ok && todayPayload?.menu) {
        setTodayMenu({
          status: todayPayload.menu.status || 'approved',
          meals: todayPayload.menu.meals || []
        });
      }
      if (tomorrowRes.ok && tomorrowPayload?.menu) {
        setTomorrowMenu({
          status: tomorrowPayload.menu.status || 'awaiting_approval',
          meals: tomorrowPayload.menu.meals || []
        });
        cacheGeneratedMenuDay(tomorrowPayload.menu);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.log('Load menus error:', (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [today, tomorrow, dietPreference]);

  useEffect(() => {
    const controller = new AbortController();

    loadMenuData(controller.signal);

    const cleanupRefresh = subscribeSocketEvent(SOCKET_EVENTS.dashboardRefresh, () => {
      loadMenuData(controller.signal);
    });
    const cleanupNotifications = subscribeSocketEvent(SOCKET_EVENTS.notificationsUpdated, () => {
      loadMenuData(controller.signal);
    });

    return () => {
      controller.abort();
      cleanupRefresh();
      cleanupNotifications();
    };
  }, [loadMenuData]);

  const renderMenuSection = (title: string, dateLabel: string, menuData: { status: string; meals: any[] }) => {
    const isToday = dateLabel.includes(formatIstDateLabel(new Date(), { day: 'numeric', month: 'short' }));
    const isApproved = menuData.status === 'approved' || isToday;
    const hasMeals = menuData.meals.length > 0;

    return (
      <div className="glass-card p-5 border border-white/8 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-3">
          <div>
            <h3 className="text-base font-bold text-white">{title}</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{dateLabel}</p>
          </div>
          <div className="shrink-0">
            {isApproved ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-500/12 text-green-300 border border-green-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Approved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/12 text-amber-300 border border-amber-500/20 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Awaiting Approval
              </span>
            )}
          </div>
        </div>

        {!hasMeals ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))] py-6 text-center">No menu available for this date yet.</p>
        ) : (
          <>
            {!isApproved && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-3 text-xs text-amber-100">
                Preview only — this menu is still awaiting staff approval, but the generated items are visible here.
              </div>
            )}
            <div className="grid gap-3.5 sm:grid-cols-2">
            {menuData.meals.map((meal) => {
              const winningItems = meal.winningItems.flatMap((item: any) => item.items);
              const fixedItems = meal.fixedItems || [];
              const itemsList = Array.from(new Set([...winningItems]));

              return (
                <div key={meal.mealType} className="p-3.5 rounded-xl bg-white/4 border border-white/6 hover:border-white/12 transition-all relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-1.5">
                    <div className="text-[10px] font-bold text-indigo-400/30 group-hover:text-indigo-400/50 transition-colors uppercase tracking-tighter">
                      Winning Menu
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">
                      {meal.mealType === 'breakfast' ? '🌅' : meal.mealType === 'lunch' ? '☀️' : meal.mealType === 'snack' ? '🍪' : '🌙'}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300">{meal.mealType}</h4>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{meal.title}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 relative z-10">
                    {itemsList.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-white/90">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/40" />
                        <span className="font-medium">{item}</span>
                      </div>
                    ))}
                    {fixedItems.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-white/4 flex flex-wrap gap-1.5">
                        {fixedItems.map((item: any, idx: number) => (
                          <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/5">
                            {item}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="absolute -bottom-1 -right-1 opacity-5 group-hover:opacity-10 transition-opacity">
                    <div className="text-4xl rotate-12">🏆</div>
                  </div>
                </div>
              );
            })}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 mt-3 sm:mt-4">
        <h2 className="text-lg sm:text-xl font-bold text-white">Mess Menu</h2>
        <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))]">View finalized and upcoming menus for your block</p>
      </div>

      {loading ? (
        <div className="glass-card p-8 text-center text-sm text-[hsl(var(--muted-foreground))] space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Loading the daily menus...</p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {renderMenuSection("Today's Final Served Menu", todayLabel, todayMenu)}
          {renderMenuSection("Tomorrow's Generated Menu", tomorrowLabel, tomorrowMenu)}
        </div>
      )}
    </div>
  );
}

function MealActivityView() {
  const { user } = useAuth();
  const today = getIstDateString();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadHistory = async () => {
      if (!user?.id || cancelled || controller.signal.aborted) {
        if (!cancelled) {
          setHistory([]);
          setLoading(false);
        }
        return;
      }

      try {
        const dates = Array.from({ length: 7 }, (_, index) => getIstDateString(-index));

        const [optinResponses, ratingResponses] = await Promise.all([
          Promise.all(dates.map(date => fetch(`/api/meal-optins?date=${date}&studentId=${user.id}`, { signal: controller.signal }))),
          Promise.all(dates.map(date => fetch(`/api/meal-ratings?date=${date}&studentId=${user.id}`, { signal: controller.signal }))),
        ]);

        if (controller.signal.aborted) return;

        const optinPayloads = await Promise.all(optinResponses.map(res => res.json().catch(() => ({ rows: [] }))));
        const ratingPayloads = await Promise.all(ratingResponses.map(res => res.json().catch(() => ({ rows: [] }))));

        const nextHistory = dates.map((date, index) => {
          const optins = Array.isArray(optinPayloads[index]?.rows) ? optinPayloads[index].rows : [];
          const ratings = Array.isArray(ratingPayloads[index]?.rows) ? ratingPayloads[index].rows : [];
          const attended = optins.filter((row: any) => ['attending', 'takeaway'].includes(String(row.status || '').toLowerCase()));
          const skipped = optins.filter((row: any) => String(row.status || '').toLowerCase() === 'skip');
          const totalRating = ratings.reduce((sum: number, row: any) => sum + Number(row.rating || 0), 0);
          const avgRating = ratings.length ? totalRating / ratings.length : 0;

          const summaryLabel = ratings.length
            ? `⭐ ${avgRating.toFixed(1)}/5 average · ${attended.length} meals confirmed`
            : `${attended.length} meals confirmed · ${skipped.length} skipped`;

          return {
            date,
            label: date === today ? 'Today' : date === getIstDateString(-1) ? 'Yesterday' : formatIstDateLabel(new Date(`${date}T00:00:00.000Z`), { weekday: 'short', day: 'numeric', month: 'short' }),
            subtitle: ratings.length ? `${ratings.length} ratings submitted` : 'No ratings yet',
            summaryLabel,
            optins,
            ratings,
            attendedCount: attended.length,
            skippedCount: skipped.length,
            avgRating,
          };
        });

        if (!cancelled && !controller.signal.aborted) {
          setHistory(nextHistory);
          setLoading(false);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        if (!cancelled && !controller.signal.aborted) {
          setHistory([]);
          setLoading(false);
          console.log('Load history error:', (error as Error).message);
        }
      }
    };

    loadHistory();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [user?.id, today]);

  const summary = useMemo(() => {
    const allOptins = history.flatMap(day => day.optins || []);
    const allRatings = history.flatMap(day => day.ratings || []);
    const attended = allOptins.filter((row: any) => ['attending', 'takeaway'].includes(String(row.status || '').toLowerCase()));
    const skipped = allOptins.filter((row: any) => String(row.status || '').toLowerCase() === 'skip');
    const ratingSum = allRatings.reduce((sum: number, row: any) => sum + Number(row.rating || 0), 0);
    const avgRating = allRatings.length ? ratingSum / allRatings.length : 0;
    const participation = history.length ? Math.round((attended.length / (history.length * 4)) * 100) : 0;

    const mealTypeCounts = attended.reduce((acc: Record<string, number>, row: any) => {
      const mealType = String(row.meal_type || 'meal').toLowerCase();
      acc[mealType] = (acc[mealType] || 0) + 1;
      return acc;
    }, {});

    const favoriteMealType = Object.entries(mealTypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'dinner';

    const dishCounts = allRatings.reduce((acc: Record<string, number>, row: any) => {
      const dish = String(row.dish_name || row.meal_type || 'Dish').trim();
      acc[dish] = (acc[dish] || 0) + 1;
      return acc;
    }, {});

    const mostRatedDish = Object.entries(dishCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Your favorite dish';

    let streak = 0;
    for (const day of history) {
      if ((day.attendedCount || day.ratings.length) > 0) {
        streak += 1;
      } else {
        break;
      }
    }

    const bestRatedDay = history
      .filter((day: any) => day.ratings.length > 0)
      .sort((a: any, b: any) => (b.avgRating || 0) - (a.avgRating || 0))[0];

    return {
      streak,
      mealsEaten: attended.length,
      avgRating,
      participation,
      favoriteMealType,
      mostRatedDish,
      bestRatedDay,
      skipped: skipped.length,
    };
  }, [history]);

  return (
    <div className="space-y-5">
      <div className="mt-3 sm:mt-4 space-y-1">
        <h2 className="text-lg sm:text-xl font-bold text-white">Personal Meal Journey</h2>
        <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))]">A quick look at your recent meals, ratings, and streaks from the data you already collect.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Current Streak', value: `${summary.streak} days`, accent: 'text-amber-300', icon: '🔥' },
          { label: 'Meals Eaten', value: String(summary.mealsEaten), accent: 'text-emerald-300', icon: '🍽️' },
          { label: 'Avg Rating', value: summary.avgRating ? `${summary.avgRating.toFixed(1)}/5` : '—', accent: 'text-yellow-300', icon: '⭐' },
          { label: 'Participation', value: `${summary.participation}%`, accent: 'text-cyan-300', icon: '🏅' },
        ].map(card => (
          <div key={card.label} className="glass-card p-4 border border-white/8">
            <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
              <span>{card.label}</span>
              <span className="text-base">{card.icon}</span>
            </div>
            <div className={`mt-3 text-2xl font-black ${card.accent}`}>{card.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="glass-card p-4 text-sm text-[hsl(var(--muted-foreground))] text-center">Loading your meal journey...</div>
      ) : history.length === 0 ? (
        <div className="glass-card p-5 text-center">
          <div className="text-3xl mb-2">🌱</div>
          <p className="text-sm font-semibold text-white">No journey data yet</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Once you opt in or rate meals, this dashboard will start telling your story.</p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="glass-card p-5 border border-white/8">
            <div className="flex items-center justify-between gap-3 border-b border-white/6 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Meal Activity Timeline</h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Recent activity from your personal meal history.</p>
              </div>
              <span className="rounded-full bg-emerald-500/10 text-emerald-200 border border-emerald-500/20 px-3 py-1 text-[11px] font-semibold">{summary.mealsEaten} meals logged</span>
            </div>

            <div className="mt-4 space-y-3">
              {history.map((day: any) => (
                <article key={day.date} className="rounded-2xl border border-white/6 bg-white/4 p-4 shadow-inner shadow-black/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-indigo-200/80">{day.label}</p>
                      <h4 className="text-sm font-semibold text-white mt-1">{day.subtitle}</h4>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex rounded-full bg-white/6 border border-white/8 px-2.5 py-1 text-[10px] font-semibold text-white/80">{day.attendedCount} eaten</span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{day.summaryLabel}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {day.optins.length === 0 && day.ratings.length === 0 ? (
                      <span className="text-[11px] rounded-full border border-dashed border-white/12 bg-white/4 px-2.5 py-1 text-white/65">No activity recorded</span>
                    ) : (
                      <>
                        {day.optins.slice(0, 4).map((row: any) => (
                          <span key={`${day.date}-optin-${row.meal_type}`} className="text-[11px] rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-emerald-100">
                            {row.status === 'attending' ? '✅' : row.status === 'takeaway' ? '📦' : '⏭️'} {String(row.meal_type || 'meal').replace(/^./, (s: string) => s.toUpperCase())}
                          </span>
                        ))}
                        {day.ratings.slice(0, 3).map((row: any) => (
                          <span key={`${day.date}-rating-${row.meal_type}`} className="text-[11px] rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-amber-100">
                            ⭐ {String(row.meal_type || 'meal').replace(/^./, (s: string) => s.toUpperCase())} • {Number(row.rating || 0)}/5
                          </span>
                        ))}
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="glass-card p-5 border border-white/8">
              <h3 className="text-base font-bold text-white">Highlights</h3>
              <div className="mt-4 space-y-3 text-sm text-white/90">
                <div className="rounded-2xl border border-white/8 bg-white/4 p-3">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-indigo-200/80">Favorite meal type</p>
                  <p className="mt-1 text-base font-semibold text-white">{String(summary.favoriteMealType).replace(/^./, (s: string) => s.toUpperCase())}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/4 p-3">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-indigo-200/80">Most rated dish</p>
                  <p className="mt-1 text-base font-semibold text-white">{summary.mostRatedDish}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/4 p-3">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-indigo-200/80">Best rated day</p>
                  <p className="mt-1 text-base font-semibold text-white">{summary.bestRatedDay ? summary.bestRatedDay.label : 'Not enough data yet'}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{summary.bestRatedDay ? `${summary.bestRatedDay.avgRating.toFixed(1)}/5 average` : 'Rate meals to unlock this insight.'}</p>
                </div>
              </div>
            </div>

            <div className="glass-card p-5 border border-white/8">
              <h3 className="text-base font-bold text-white">Achievements</h3>
              <div className="mt-4 grid gap-3 text-xs text-white/85">
                {[
                  { label: 'Early Bird', detail: `${history.filter((day: any) => day.attendedCount > 0).length} active days`, badge: summary.mealsEaten >= 5 ? 'Unlocked' : 'In progress' },
                  { label: 'Food Critic', detail: `${history.flatMap((day: any) => day.ratings || []).length} ratings submitted`, badge: history.flatMap((day: any) => day.ratings || []).length >= 10 ? 'Unlocked' : 'In progress' },
                  { label: 'Consistent Eater', detail: `${summary.streak} day streak`, badge: summary.streak >= 5 ? 'Unlocked' : 'In progress' },
                  { label: 'Waste Warrior', detail: `${summary.skipped} skipped meals`, badge: summary.skipped <= 3 ? 'Unlocked' : 'Keep going' },
                ].map(item => (
                  <div key={item.label} className="rounded-2xl border border-white/8 bg-white/4 p-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{item.label}</p>
                      <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">{item.detail}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-white/70">{item.badge}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}