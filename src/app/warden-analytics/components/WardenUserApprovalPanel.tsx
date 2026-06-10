'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, UserPlus, UserX, ShieldAlert, Clock3 } from 'lucide-react';

type PendingUser = {
  id: string;
  rollNo?: string;
  email: string;
  name: string;
  role: 'student' | 'staff' | 'warden';
  hostelId: string;
  foodPreference: 'veg' | 'non_veg';
  accountStatus: 'pending' | 'approved' | 'rejected' | 'disabled';
};

type WardenUserApprovalPanelProps = {
  compact?: boolean;
  onViewAllClick?: () => void;
};

export default function WardenUserApprovalPanel({ compact = false, onViewAllClick }: WardenUserApprovalPanelProps) {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPendingUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/warden/users?status=pending');
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.message || 'Failed to load pending approvals.');
      }
      setPendingUsers(Array.isArray(payload.users) ? payload.users : []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPendingUsers();
  }, []);

  const updateStatus = async (userId: string, status: 'approved' | 'rejected' | 'disabled') => {
    setActionLoading(userId);
    setError(null);
    try {
      const res = await fetch('/api/warden/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.message || 'Failed to update account status.');
      }
      await fetchPendingUsers();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div id="user-approval-center" className="glass-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-white/40 mb-2 flex items-center gap-2">
            <ShieldAlert size={14} /> User approval center
          </div>
          <h2 className="text-2xl font-bold text-white">Approve new accounts</h2>
          <p className="max-w-2xl text-sm text-[hsl(var(--muted-foreground))] mt-2">
            Review new registrations and grant access only when they are verified by the warden.
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
          Pending approvals: <span className="font-semibold text-white">{pendingUsers.length}</span>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      <div className="mt-5 space-y-4">
        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
            <div className="flex items-center gap-3">
              <Clock3 size={18} />
              <span>Loading pending approvals…</span>
            </div>
          </div>
        ) : pendingUsers.length === 0 ? (
          <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-emerald-100">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={18} />
              <span>All new accounts are reviewed. No pending approvals.</span>
            </div>
          </div>
        ) : compact ? (
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-white/70">Pending approvals</p>
                  <p className="text-3xl font-semibold text-white">{pendingUsers.length}</p>
                </div>
                <button
                  type="button"
                  onClick={onViewAllClick}
                  className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/15"
                >
                  View all
                </button>
              </div>
            </div>
            <div className="grid gap-3">
              {pendingUsers.slice(0, 2).map((user) => (
                <div key={user.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{user.name}</p>
                      <p className="text-sm text-white/60">{user.email}</p>
                    </div>
                    <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
                      {user.role}
                    </span>
                  </div>
                </div>
              ))}
              {pendingUsers.length > 2 && (
                <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                  +{pendingUsers.length - 2} more pending approvals
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingUsers.map((user) => (
              <div key={user.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <p className="text-base font-semibold text-white">{user.name}</p>
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-white/50">
                        {user.role}
                      </span>
                    </div>
                    <p className="text-sm text-white/70">{user.email}</p>
                    {user.rollNo && <p className="text-sm text-white/60">Roll No: {user.rollNo}</p>}
                    <p className="text-sm text-white/60">Hostel / room: {user.hostelId}</p>
                    <p className="text-sm text-white/60">Food preference: {user.foodPreference}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void updateStatus(user.id, 'approved')}
                      disabled={actionLoading === user.id}
                      className="rounded-full border border-emerald-400 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateStatus(user.id, 'rejected')}
                      disabled={actionLoading === user.id}
                      className="rounded-full border border-rose-400 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateStatus(user.id, 'disabled')}
                      disabled={actionLoading === user.id}
                      className="rounded-full border border-amber-400 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/20 disabled:opacity-50"
                    >
                      Disable
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
