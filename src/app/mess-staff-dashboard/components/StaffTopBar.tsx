'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, RefreshCw, Bell, Monitor, BookOpen, ClipboardList, Settings, FileDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

type StaffTopBarProps = {
  onTodayPlanClick?: () => void;
  onRefreshClick?: () => void;
};

export default function StaffTopBar({ onTodayPlanClick, onRefreshClick }: StaffTopBarProps) {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [dbNotifications, setDbNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [exporting, setExporting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const displayName = user?.name || 'Mess Staff';
  const displayHostel = user?.hostelId || 'A';

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch('/api/reports/export', { method: 'GET' });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'MessMate-Report-June-2026.html';
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
    setExporting(false);
  };

  const loadNotifications = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/notifications', { signal });
      if (!response.ok || signal?.aborted) return;
      const data = await response.json();
      const rows = Array.isArray(data.rows) ? data.rows : [];
      setDbNotifications(rows);
      setUnreadCount(rows.filter((n: NotificationRow) => !n.is_read).length);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.log('Failed to load staff notifications:', error);
    }
  }, []);

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

      setDbNotifications((prev) => prev.map((notification) => notification.id === id ? { ...notification, is_read: true } : notification));
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (error) {
      console.log('Mark notification read failed:', error);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadNotifications(controller.signal);
    const intervalId = window.setInterval(() => loadNotifications(controller.signal), 30000);
    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [loadNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setNotificationsOpen(false);
      }
    };

    if (notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notificationsOpen]);

  const handleSignOut = async () => {
    // First navigate to login page immediately
    router.replace('/sign-up-login-screen');
    // Then clear auth state
    await signOut();
    router.refresh();
  };

  return (
    <div className="py-3.5 sm:py-4 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[0.9rem] gradient-primary flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.14)]">
            <span className="text-lg">👨‍🍳</span>
          </div>
          <div>
            <h1 className="text-base sm:text-lg lg:text-xl font-bold text-white leading-tight">Mess Staff Dashboard</h1>
            <p className="text-[11px] sm:text-xs lg:text-sm text-[hsl(var(--muted-foreground))]">
              {displayName} · Head Cook · Hostel {displayHostel} Mess
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
          <span className="text-[10px] sm:text-[11px] bg-green-500/15 text-green-400 border border-green-500/25 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-slow" />
            Mess Open
          </span>
          <span className="text-[10px] sm:text-[11px] lg:text-xs text-[hsl(var(--muted-foreground))]">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap lg:justify-end">
        <button
          onClick={onTodayPlanClick}
          className="btn-glass hidden sm:inline-flex items-center gap-2 text-sm"
        >
          <ClipboardList size={14} />
          <span>Today&apos;s Plan</span>
        </button>
        <button
          onClick={() => router?.push('/live-display')}
          className="btn-glass hidden sm:inline-flex items-center gap-2 text-sm"
        >
          <Monitor size={14} />
          <span>Live Board</span>
        </button>
        <button
          onClick={() => router?.push('/guide')}
          className="btn-glass hidden sm:inline-flex items-center gap-2 text-sm"
        >
          <BookOpen size={14} />
          <span>Guide</span>
        </button>
        <button
          onClick={() => router.push('/profile')}
          className="btn-glass hidden sm:inline-flex items-center gap-2 text-sm"
        >
          <Settings size={14} />
          <span>Profile</span>
        </button>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="btn-glass hidden sm:inline-flex items-center gap-2 text-sm bg-gradient-to-r from-emerald-600/20 to-indigo-600/20 border-emerald-400/30"
        >
          <FileDown size={14} />
          <span>{exporting ? 'Exporting...' : 'Export Report'}</span>
        </button>
        <button
          onClick={onRefreshClick}
          className="btn-glass hidden sm:inline-flex items-center gap-2 text-sm"
        >
          <RefreshCw size={14} />
          <span>Refresh Data</span>
        </button>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setNotificationsOpen((open) => !open)}
            className="w-9 h-9 rounded-[0.9rem] bg-white/6 border border-white/8 flex items-center justify-center hover:bg-white/10 transition-all relative"
            aria-label="Notifications"
          >
            <Bell size={15} className="text-white/70" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">{unreadCount}</span>
          </button>
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] rounded-[1.1rem] border border-white/10 bg-slate-950/95 shadow-2xl p-3 z-50">
              <div className="flex items-center justify-between gap-3 pb-2 border-b border-white/10 mb-2">
                <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Notifications</p>
                <span className="text-xs font-medium text-cyan-300">{unreadCount} unread</span>
              </div>
              <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                {dbNotifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-white/50">No new notifications</div>
                ) : dbNotifications.map((n) => (
                  <div
                    key={n.id}
                    className={`w-full rounded-xl px-3 py-2 border transition-all ${!n.is_read ? 'bg-indigo-500/14 border-indigo-500/30' : 'bg-white/5 border-white/8'}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="font-bold text-[11px] uppercase tracking-wider text-indigo-300">{n.title || 'Notice'}</p>
                        <p className="text-[10px] mt-1 opacity-70 text-white/70">{new Date(n.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      {!n.is_read && (
                        <button
                          type="button"
                          onClick={() => markRead(n.id)}
                          className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/90 hover:bg-white/15"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-white/80 leading-snug">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={handleSignOut}
          className="w-9 h-9 rounded-[0.9rem] bg-white/6 border border-white/8 flex items-center justify-center hover:bg-red-500/15 hover:border-red-500/30 transition-all"
        >
          <LogOut size={15} className="text-white/70" />
        </button>
      </div>
    </div>
  );
}