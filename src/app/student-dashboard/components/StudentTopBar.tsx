'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Bell, BookOpen, LogOut, Moon, Sun, Settings, CheckCircle2, UserCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { formatIstDateLabel, getIstDateString, getIstNow } from '@/lib/utils/mealStatus';
import { useDietPreference } from '@/hooks/useDietPreference';
import { toast } from 'sonner';

interface StudentTopBarProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export default function StudentTopBar({ theme, onToggleTheme }: StudentTopBarProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [showNotifs, setShowNotifs] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [streakCount, setStreakCount] = useState<number | null>(null);
  const [dbNotifications, setDbNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async (signal?: AbortSignal) => {
    if (!user?.id) return;
    try {
      const response = await fetch('/api/notifications', { signal });
      if (response.ok && !signal?.aborted) {
        const data = await response.json();
        setDbNotifications(data.rows || []);
        setUnreadCount(data.rows?.filter((n: any) => !n.is_read)?.length || 0);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.log('Load notifications error:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    const controller = new AbortController();
    loadNotifications(controller.signal);
    const id = setInterval(() => loadNotifications(controller.signal), 30000); // Poll every 30s
    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, [loadNotifications]);

  const markRead = async (id: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || 'Failed to mark notification as read.');
      }

      setDbNotifications((prevNotifications) =>
        prevNotifications.map((notification) =>
          notification.id === id ? { ...notification, is_read: true } : notification
        )
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (err) {
      console.log('Mark read error:', err);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 14);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadStreak() {
      if (!user?.id) {
        if (!cancelled) {
          setStreakCount(0);
        }
        return;
      }

      try {
        let count = 0;
        for (let offset = 0; offset < 30; offset += 1) {
          if (controller.signal.aborted) break;
          const date = getIstDateString(-offset);
          const response = await fetch(`/api/meal-optins?date=${date}&studentId=${user.id}`, { signal: controller.signal });
          if (!response.ok) {
            break;
          }

          const payload = await response.json().catch(() => ({}));
          const rows = Array.isArray(payload?.rows) ? payload.rows : [];
          if (rows.length === 0) {
            break;
          }

          count += 1;
        }

        if (!cancelled && !controller.signal.aborted) {
          setStreakCount(count);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (!cancelled && !controller.signal.aborted) {
          setStreakCount(0);
        }
      }
    }

    void loadStreak();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [user?.id]);

  const notificationsToDisplay = dbNotifications.length > 0 ? dbNotifications : [
    { id: 'notif-001', title: 'Welcome!', message: 'Voting for tomorrow\'s breakfast is now open!', created_at: new Date().toISOString(), is_read: false },
    { id: 'notif-002', title: 'Leftovers', message: 'Extra Gulab Jamun available — claim now!', created_at: new Date().toISOString(), is_read: false },
  ];

  const displayName = user?.name || 'Student';
  const roomLabel = user ? `Hostel ${user.hostelId}` : 'Hostel A';
  const todayLabel = formatIstDateLabel(getIstNow(), {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
  const streakLabel = streakCount === null ? '...' : `${streakCount} day${streakCount === 1 ? '' : 's'} streak`;

  const handleSignOut = async () => {
    // First navigate to login page immediately
    router.replace('/sign-up-login-screen');
    // Then clear auth state
    await signOut();
    router.refresh();
  };

  const userPreference = useDietPreference();

  return (
    <div className={`student-sticky-shell ${isScrolled ? 'scrolled' : ''}`}>
      <div className={`px-0 ${isScrolled ? 'pt-2 pb-1.5' : 'pt-3 pb-2'} transition-all duration-200`}>
        <div className={`student-glass-card px-3 sm:px-4 lg:px-5 ${isScrolled ? 'py-2.5' : 'py-3'} transition-all duration-200`}>
          <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3 lg:gap-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-[0.85rem] gradient-primary flex items-center justify-center shadow-[0_0_16px_rgba(99,102,241,0.2)]">
                <span className="text-lg">🍽️</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className="text-[13px] sm:text-sm lg:text-[15px] font-bold leading-tight whitespace-nowrap" style={{ color: 'var(--student-text)' }}>Hey, {displayName}! 👋</div>
                  <div 
                    onClick={() => toast.info('Request to change food preference has been sent to mess staff.')}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center gap-1 ${
                      userPreference === 'veg' 
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {userPreference === 'veg' ? (
                      <><span className="text-[12px]">🥗</span> VEGETARIAN</>
                    ) : (
                      <><span className="text-[12px]">🍗</span> NON-VEG</>
                    )}
                  </div>
                </div>
                <div className="mt-0.5 text-[10px] sm:text-xs leading-snug whitespace-nowrap tracking-[0.01em]" style={{ color: 'var(--student-muted)' }}>Student dashboard · {roomLabel}</div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-2.5 flex-nowrap md:justify-end shrink-0">
              <button
                onClick={onToggleTheme}
                aria-label="Toggle theme"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-[0.85rem] bg-white/10 dark:bg-white/10 dark:border-white/15 border border-black/5 flex items-center justify-center hover:bg-white/16 dark:hover:bg-white/16 transition-all"
              >
                {theme === 'dark' ? <Sun size={14} className="text-amber-300" /> : <Moon size={14} className="text-indigo-600" />}
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowNotifs(!showNotifs)}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-[0.85rem] bg-white/10 dark:bg-white/10 dark:border-white/15 border border-black/5 flex items-center justify-center hover:bg-white/16 dark:hover:bg-white/16 transition-all relative"
                >
                  <Bell size={14} className={theme === 'dark' ? 'text-white/80' : 'text-slate-700'} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifs && (
                  <div className="absolute right-0 top-10 w-80 max-w-[calc(100vw-1.5rem)] student-notification-panel p-3 space-y-2 z-50">
                    <div className="flex items-center justify-between px-1 pb-2 border-b border-white/10">
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--student-muted)' }}>Notifications</p>
                      <span className="text-xs font-medium text-cyan-300">{unreadCount} unread</span>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                      {notificationsToDisplay?.map(n => (
                        <div
                          key={n?.id}
                          className={`p-3 rounded-xl text-sm border transition-all ${!n?.is_read ? 'bg-indigo-500/14 border-indigo-500/30' : 'bg-white/5 border-white/10'}`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div>
                              <p className="font-bold text-[11px] uppercase tracking-wider text-indigo-300">{n?.title || 'Notice'}</p>
                              <p className="text-[10px] mt-1 opacity-70 text-white/70">{new Date(n.created_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            {!n?.is_read && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  markRead(n.id);
                                }}
                                className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/90 hover:bg-white/15"
                              >
                                Mark read
                              </button>
                            )}
                          </div>
                          <p className="leading-snug text-xs whitespace-pre-wrap" style={{ color: 'var(--student-text)' }}>{n?.message || n?.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => router?.push('/guide')}
                className="h-8 sm:h-9 rounded-[0.85rem] bg-white/10 dark:bg-white/10 dark:border-white/15 border border-black/5 px-2.5 sm:px-3 lg:px-3.5 flex items-center justify-center gap-1.5 hover:bg-white/16 dark:hover:bg-white/16 transition-all"
              >
                <BookOpen size={14} className={theme === 'dark' ? 'text-white/80' : 'text-slate-700'} />
                <span className={`hidden sm:inline text-xs font-semibold ${theme === 'dark' ? 'text-white/80' : 'text-slate-700'}`}>Guide</span>
              </button>

              <button
                onClick={() => router.push('/profile')}
                className="h-8 sm:h-9 rounded-[0.85rem] bg-white/10 dark:bg-white/10 dark:border-white/15 border border-black/5 px-2.5 sm:px-3 lg:px-3.5 flex items-center justify-center gap-1.5 hover:bg-white/16 dark:hover:bg-white/16 transition-all"
              >
                <Settings size={14} className={theme === 'dark' ? 'text-white/80' : 'text-slate-700'} />
                <span className={`hidden sm:inline text-xs font-semibold ${theme === 'dark' ? 'text-white/80' : 'text-slate-700'}`}>Profile</span>
              </button>

              <button
                onClick={handleSignOut}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-[0.85rem] bg-white/10 dark:bg-white/10 dark:border-white/15 border border-black/5 flex items-center justify-center hover:bg-red-500/15 dark:hover:bg-red-500/15 hover:border-red-500/30 dark:hover:border-red-500/30 transition-all"
              >
                <LogOut size={14} className={theme === 'dark' ? 'text-white/80' : 'text-slate-700'} />
              </button>
            </div>
          </div>
        </div>
        {/* Date + streak */}
        <div className={`mt-2 sm:mt-3 flex items-center justify-between gap-2.5 px-1 transition-all duration-200 ${isScrolled ? 'pb-1.5' : 'pb-2'}`}>
          <div className="min-w-0">
            <h1 className={`${isScrolled ? 'text-sm sm:text-base lg:text-[1.1rem]' : 'text-base sm:text-lg lg:text-[1.2rem]'} font-bold leading-tight transition-all duration-200`} style={{ color: 'var(--student-text)' }}>{todayLabel}</h1>
            <p className="text-[10px] sm:text-xs lg:text-sm whitespace-nowrap leading-tight" style={{ color: 'var(--student-muted)' }}>Today&apos;s Mess Schedule</p>
          </div>
          <div className="flex items-center justify-end shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2 bg-orange-500/15 border border-orange-500/30 px-2.5 sm:px-3 py-1 rounded-full shadow-[0_0_16px_rgba(245,158,11,0.18)]">
              <span className="text-sm">🔥</span>
              <span className="text-[11px] sm:text-sm font-bold text-orange-400 whitespace-nowrap">{streakLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
