'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, Loader2, MessageCircle, RefreshCw, ShieldCheck, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { getIstDateString } from '@/lib/utils/mealStatus';

type WardenMenuFeedback = {
  id: string;
  menu_date: string;
  meal_type: string | null;
  warden_id: string;
  action: 'approve' | 'request_changes';
  comment: string | null;
  created_at: string;
};

export default function WardenMenuApprovalCenter() {
  const [draft, setDraft] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [requestChangesOpen, setRequestChangesOpen] = useState(false);
  const [requestChangesComment, setRequestChangesComment] = useState('');
  const [requestChangesMessage, setRequestChangesMessage] = useState<string | null>(null);

  const tomorrow = getIstDateString(1);

  const loadDraft = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/warden/final-menu?date=${tomorrow}`);
      const payload = await response.json().catch(() => ({}));
      console.log('WARDEN MENU APPROVAL PAYLOAD:', payload);
      console.log('WARDEN MENU APPROVAL DATE:', tomorrow);
      if (!response.ok) throw new Error(payload?.message || 'Unable to load menu.');
      setDraft(payload.menu || null);
    } catch (err: any) {
      setError(err?.message || 'Unable to load draft.');
    } finally {
      setLoading(false);
    }
  }, [tomorrow]);

  useEffect(() => {
    void loadDraft();
  }, [loadDraft]);

  const approveMenu = async () => {
    setActionInProgress(true);
    try {
      const response = await fetch(`/api/warden/final-menu?date=${tomorrow}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to approve menu');
      
      toast.success('Menu approved successfully!');
      // Refresh the draft data
      await loadDraft();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionInProgress(false);
    }
  };

  const requestMenuChanges = async () => {
    if (!requestChangesComment.trim()) {
      setError('Please enter a brief change request before submitting.');
      return;
    }

    setActionInProgress(true);
    setError(null);
    setRequestChangesMessage(null);

    try {
      const response = await fetch(`/api/warden/final-menu?date=${tomorrow}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_changes', comment: requestChangesComment }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message || 'Unable to send request.');
      }

      setRequestChangesMessage(payload?.message || 'Change request sent to staff.');
      setRequestChangesOpen(false);
      setRequestChangesComment('');
      await loadDraft();
    } catch (err: any) {
      setError(err?.message || 'Unable to send change request.');
    } finally {
      setActionInProgress(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">Menu approval</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Review and authorize tomorrow's finalized menu.</p>
        </div>
        <button 
          onClick={loadDraft} 
          disabled={loading}
          className="p-2 hover:bg-white/5 rounded-full text-white/40 transition-colors"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="h-24 rounded-3xl bg-white/5 animate-pulse" />
      ) : (
        <>
          {draft && draft.status !== 'approved' ? (
            <div className="glass-card p-5 space-y-5 border-indigo-500/30 bg-indigo-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <CalendarClock size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Review Menu Draft</h3>
                    <p className="text-[10px] uppercase tracking-wider text-indigo-300/60 font-semibold">Tomorrow: {tomorrow}</p>
                  </div>
                </div>
                <div className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold uppercase tracking-wider border border-amber-500/20">
                  Pending Approval
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {draft.meals.map((meal: any) => (
                  <div key={meal.mealType} className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-1">{meal.mealType}</div>
                    <div className="text-sm font-semibold text-white">{meal.title}</div>
                    <div className="mt-1 text-[11px] text-indigo-300/70">{meal.winningItems.map((i: any) => i.label).join(' + ')}</div>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={approveMenu}
                  disabled={actionInProgress}
                  className="flex-1 min-w-[140px] rounded-2xl bg-emerald-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionInProgress ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={18} />}
                  Approve Menu
                </button>
                <button
                  type="button"
                  onClick={() => setRequestChangesOpen(true)}
                  disabled={actionInProgress}
                  className="flex-1 min-w-[140px] rounded-2xl bg-white/5 border border-white/10 py-3 text-sm font-bold text-white transition hover:bg-white/10 flex items-center justify-center gap-2"
                >
                  <MessageSquare size={18} />
                  Request Changes
                </button>
              </div>

              {requestChangesOpen && (
                <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/80 p-3">
                  <label className="text-sm text-slate-300">Change request details</label>
                  <textarea
                    value={requestChangesComment}
                    onChange={(event) => setRequestChangesComment(event.target.value)}
                    rows={3}
                    className="input-glass w-full resize-none bg-slate-950/90 text-white placeholder:text-slate-500"
                    placeholder="Ask staff to swap a dish, adjust quantities, or preserve a vote override."
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={requestMenuChanges}
                      disabled={actionInProgress}
                      className="rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-400 disabled:opacity-50"
                    >
                      {actionInProgress ? 'Sending...' : 'Send request'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestChangesOpen(false)}
                      className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/5"
                    >
                      Cancel
                    </button>
                  </div>
                  {requestChangesMessage && (
                    <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                      {requestChangesMessage}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : draft?.status === 'approved' ? (
            <div className="glass-card p-5 space-y-5 border-white/10 bg-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Tomorrow’s menu is approved</h3>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Tomorrow: {tomorrow}</p>
                  </div>
                </div>
                <div className="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase tracking-wider border border-indigo-500/20">
                  Finalized
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {draft.meals.map((meal: any) => (
                  <div key={meal.mealType} className="rounded-2xl border border-white/10 bg-slate-950/40 p-3 hover:bg-white/5 transition-colors">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-1">{meal.mealType}</div>
                    <div className="text-sm font-semibold text-white">{meal.title}</div>
                    <div className="mt-1 text-[11px] text-slate-400">{meal.winningItems.map((i: any) => i.label).join(' + ')}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3 text-white/80">
                <CheckCircle2 size={18} />
                <span>No menu draft is pending approval for tomorrow.</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
