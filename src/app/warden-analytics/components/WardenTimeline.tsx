'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Clock, CheckCircle2, MessageSquare, Utensils, Send, RefreshCw } from 'lucide-react';
import { getIstDateString } from '@/lib/utils/mealStatus';

type TimelineEvent = {
  time: string;
  title: string;
  description: string;
  type: 'meal' | 'submission' | 'approval' | 'feedback';
};

export default function WardenTimeline() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const today = getIstDateString();

  const loadTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/warden/timeline?date=${today}`);
      const payload = await response.json();
      setEvents(payload.events || []);
    } catch (error) {
      console.error('Failed to load timeline:', error);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  const getIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'meal': return <Utensils size={16} className="text-blue-400" />;
      case 'submission': return <Send size={16} className="text-amber-400" />;
      case 'approval': return <CheckCircle2 size={16} className="text-emerald-400" />;
      case 'feedback': return <MessageSquare size={16} className="text-rose-400" />;
      default: return <Clock size={16} className="text-slate-400" />;
    }
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">Daily Operations Timeline</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Track key events and approvals for today.</p>
        </div>
        <button onClick={loadTimeline} className="p-2 hover:bg-white/5 rounded-full text-white/40 transition-colors">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-4 py-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-4 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-white/5 shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 bg-white/5 rounded w-1/4" />
                <div className="h-3 bg-white/5 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">
          No operational events recorded yet today.
        </div>
      ) : (
        <div className="relative space-y-6 before:absolute before:left-5 before:top-2 before:bottom-2 before:w-px before:bg-white/10">
          {events.map((event, idx) => (
            <div key={idx} className="relative flex gap-4 pl-10 group">
              <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-slate-950 border border-white/10 flex items-center justify-center z-10 group-hover:border-indigo-500/50 transition-colors shadow-lg">
                {getIcon(event.type)}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-white">{event.title}</h3>
                  <span className="text-[10px] font-mono text-slate-500 bg-white/5 px-1.5 py-0.5 rounded uppercase">{event.time}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  {event.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
