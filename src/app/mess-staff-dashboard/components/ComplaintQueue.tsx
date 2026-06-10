'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Loader2, MessageSquareWarning } from 'lucide-react';
import { toast } from 'sonner';

type ComplaintRow = {
  id: string;
  studentName?: string | null;
  category: string;
  description?: string | null;
  status: 'open' | 'in-progress' | 'resolved';
  createdAt: string;
};

export default function ComplaintQueue() {
  const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadComplaints = useCallback(async () => {
    try {
      const response = await fetch('/api/complaints?role=staff');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.log('Load complaints error:', payload?.message || 'request failed');
        return;
      }

      setComplaints(Array.isArray(payload?.rows) ? payload.rows : []);
    } catch (error: any) {
      console.log('Load complaints error:', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadComplaints();

    const id = window.setInterval(() => {
      void loadComplaints();
    }, 60000);

    return () => {
      window.clearInterval(id);
    };
  }, [loadComplaints]);

  const updateStatus = async (id: string, status: ComplaintRow['status']) => {
    if (status === 'open') {
      return;
    }

    setSavingId(id);
    try {
      const response = await fetch(`/api/complaints/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload?.message || 'Failed to update complaint.');
        return;
      }

      setComplaints(prev => prev.map(item => (item.id === id ? { ...item, status } : item)));
      toast.success(status === 'resolved' ? 'Complaint marked resolved.' : 'Complaint moved to in-progress.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update complaint.');
    } finally {
      setSavingId(null);
    }
  };

  const openCount = complaints.filter(item => item.status === 'open').length;
  const activeCount = complaints.filter(item => item.status === 'in-progress').length;

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white">Complaint Queue</h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Open and active complaints visible to staff</p>
        </div>
        <div className="flex items-center gap-1.5 bg-rose-500/12 border border-rose-500/25 px-2.5 py-1 rounded-full text-rose-300 text-xs font-semibold">
          <MessageSquareWarning size={12} />
          {openCount + activeCount} active
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/8 bg-white/4 p-3">
          <div className="text-xs text-white/45 uppercase tracking-wider font-semibold">Open</div>
          <div className="text-2xl font-bold text-white mt-1">{openCount}</div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/4 p-3">
          <div className="text-xs text-white/45 uppercase tracking-wider font-semibold">In progress</div>
          <div className="text-2xl font-bold text-white mt-1">{activeCount}</div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[0, 1].map(index => (
            <div key={`complaint-skeleton-${index}`} className="rounded-2xl border border-white/8 bg-white/4 p-4 h-32" />
          ))}
        </div>
      ) : complaints.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-white/4 p-4 text-sm text-[hsl(var(--muted-foreground))]">
          No complaints are waiting right now.
        </div>
      ) : (
        <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
          {complaints.map(item => (
            <div
              key={item.id}
              className={`rounded-2xl border p-4 transition-all ${
                item.status === 'resolved'
                  ? 'border-emerald-500/20 bg-emerald-500/8'
                  : item.status === 'in-progress'
                    ? 'border-cyan-500/20 bg-cyan-500/8'
                    : 'border-rose-500/20 bg-rose-500/8'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-white">{item.studentName || 'Student'}</h4>
                    <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/8 text-white/70">
                      {item.category}
                    </span>
                    <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/20 text-white/70">
                      {item.status}
                    </span>
                  </div>
                  <p className="text-sm text-white/80 mt-2 leading-relaxed">{item.description}</p>
                </div>
                {item.status === 'resolved' ? (
                  <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
                ) : (
                  <Clock3 size={18} className="text-amber-300 flex-shrink-0" />
                )}
              </div>

              <div className="flex items-center justify-between gap-3 mt-3">
                <div className="text-[11px] text-white/45 font-mono">
                  {new Date(item.createdAt).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>

                <label className="flex items-center gap-2 text-xs text-white/70">
                  Status
                  <select
                    value={item.status}
                    onChange={event => void updateStatus(item.id, event.target.value as ComplaintRow['status'])}
                    disabled={savingId === item.id}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none disabled:opacity-60"
                  >
                    <option value="open" disabled>
                      Open
                    </option>
                    <option value="in-progress">In progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  {savingId === item.id && <Loader2 size={12} className="animate-spin text-white/60" />}
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
